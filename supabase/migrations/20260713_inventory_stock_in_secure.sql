-- Secure, atomic replacement for the single-item "nhập kho" (mode IN) path that
-- api/data/[table].ts previously implemented as a sequence of unlocked REST calls
-- (read balance -> insert purchase_orders -> insert items -> update cost_price ->
-- update supplier debt -> write balance). That path could lose updates when two
-- users adjusted the same product/warehouse concurrently, and could leave an
-- orphaned purchase_orders row if a later step failed.
-- Apply after 20260710_finance_inventory_controls.sql (uses the same warehouse
-- lock + idempotency_keys pattern as create_inventory_receipt_secure /
-- create_inventory_stock_out_secure).

create or replace function public.create_inventory_stock_in_secure(
  p_actor_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_operation_type text,
  p_transaction_note text,
  p_supplier_id uuid,
  p_document_code text,
  p_purchase_note text,
  p_received_at timestamptz,
  p_unit_cost numeric,
  p_discount_amount numeric,
  p_vat_amount numeric,
  p_paid_amount numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_cached jsonb;
  v_warehouse public.warehouses%rowtype;
  v_product public.products%rowtype;
  v_supplier public.suppliers%rowtype;
  v_balance public.inventory_balances%rowtype;
  v_purchase public.purchase_orders%rowtype;
  v_transaction public.inventory_transactions%rowtype;
  v_current numeric := 0;
  v_stock_after numeric := 0;
  v_quantity numeric := greatest(0, coalesce(p_quantity, 0));
  v_unit_cost numeric := greatest(0, coalesce(p_unit_cost, 0));
  v_discount numeric := greatest(0, coalesce(p_discount_amount, 0));
  v_vat numeric := greatest(0, coalesce(p_vat_amount, 0));
  v_paid numeric := greatest(0, coalesce(p_paid_amount, 0));
  v_line_total numeric := 0;
  v_total numeric := 0;
  v_payable numeric := 0;
  v_purchase_id uuid;
  v_supplier_balance numeric := 0;
  v_balance_exists boolean := false;
  v_response jsonb;
begin
  if p_actor_id is null or p_product_id is null or p_warehouse_id is null then
    raise exception 'Actor, product and warehouse are required' using errcode = '22023';
  end if;
  if v_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':inventory-in:' || v_key));
  select response_json into v_cached
  from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_INVENTORY_STOCK_IN' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_warehouse from public.warehouses where id = p_warehouse_id for update;
  if not found then
    raise exception 'Warehouse is not available' using errcode = '22023';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found' using errcode = '22023';
  end if;

  select * into v_balance
  from public.inventory_balances
  where warehouse_id = p_warehouse_id and product_id = p_product_id
  for update;
  v_balance_exists := found;
  v_current := coalesce(v_balance.quantity_box, 0);
  v_stock_after := v_current + v_quantity;

  -- Mirrors the previous TS condition: only creates a purchase order when the
  -- caller supplied a cost, a supplier or an explicit document code (manual
  -- stock bumps with none of those stay a plain inventory adjustment).
  if v_unit_cost > 0 or p_supplier_id is not null or p_document_code is not null then
    if p_supplier_id is not null then
      select * into v_supplier from public.suppliers where id = p_supplier_id for update;
      if not found then
        raise exception 'Supplier not found' using errcode = '22023';
      end if;
    end if;

    v_line_total := v_quantity * v_unit_cost;
    v_total := greatest(0, v_line_total - v_discount + v_vat);
    v_paid := least(v_paid, v_total);
    v_payable := v_total - v_paid;

    insert into public.purchase_orders (
      code, purchase_date, supplier_id, warehouse_id, subtotal, discount_amount, vat_amount,
      total_amount, paid_amount, payable_amount, status, note
    ) values (
      coalesce(nullif(btrim(p_document_code), ''), 'PNK' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
      coalesce(p_received_at, now()), p_supplier_id, p_warehouse_id, v_line_total, v_discount, v_vat,
      v_total, v_paid, v_payable, 'RECEIVED', nullif(btrim(p_purchase_note), '')
    ) returning * into v_purchase;
    v_purchase_id := v_purchase.id;

    insert into public.purchase_order_items (purchase_id, product_id, product_code, product_name, unit, quantity, unit_cost, line_total)
    values (v_purchase_id, v_product.id, v_product.code, v_product.product_name, v_product.unit, v_quantity, v_unit_cost, v_line_total);

    if v_unit_cost > 0 and v_stock_after > 0 then
      update public.products
      set cost_price = round(((v_current * coalesce(v_product.cost_price, 0)) + (v_quantity * v_unit_cost)) / v_stock_after),
          updated_at = now()
      where id = v_product.id;
    end if;

    if p_supplier_id is not null and v_payable > 0 then
      v_supplier_balance := coalesce(v_supplier.current_payable, 0) + v_payable;
      update public.suppliers set current_payable = v_supplier_balance, updated_at = now() where id = p_supplier_id;
      insert into public.supplier_debt_ledger (supplier_id, source_type, source_id, debit, credit, balance_after, status, note)
      values (p_supplier_id, 'PURCHASE_ORDER', v_purchase_id, v_payable, 0, v_supplier_balance, 'OPEN', v_purchase.code);
    end if;
  end if;

  if v_balance_exists then
    update public.inventory_balances
    set quantity_box = v_stock_after, updated_at = now()
    where warehouse_id = p_warehouse_id and product_id = p_product_id;
  else
    insert into public.inventory_balances (warehouse_id, product_id, quantity_box, quantity_piece)
    values (p_warehouse_id, p_product_id, v_stock_after, 0);
  end if;

  insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note)
  values (p_warehouse_id, p_product_id, coalesce(nullif(btrim(p_operation_type), ''), 'PURCHASE_IN'), v_purchase_id, v_quantity, v_stock_after, nullif(btrim(p_transaction_note), ''))
  returning * into v_transaction;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'IN', 'inventory', v_transaction.id::text, to_jsonb(v_transaction));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'transaction', to_jsonb(v_transaction), 'stockAfter', v_stock_after, 'purchaseId', v_purchase_id);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_INVENTORY_STOCK_IN', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_inventory_stock_in_secure(uuid, uuid, uuid, numeric, text, text, uuid, text, text, timestamptz, numeric, numeric, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.create_inventory_stock_in_secure(uuid, uuid, uuid, numeric, text, text, uuid, text, text, timestamptz, numeric, numeric, numeric, numeric, text) to service_role;

-- Defense in depth: the RPCs above already prevent negative stock via row locks,
-- but there was no constraint at the table level. NOT VALID so it applies to all
-- new/updated rows immediately without failing the migration if historical rows
-- are already negative (run `validate constraint` manually once those are cleaned up).
alter table public.inventory_balances
  add constraint inventory_balances_quantity_box_nonneg check (quantity_box >= 0) not valid;
