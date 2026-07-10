-- Finance and inventory controls: atomic multi-line receiving and protected stock-out.
-- Apply after 20260710_secure_transactions_rls.sql.

create or replace function public.create_inventory_receipt_secure(
  p_actor_id uuid,
  p_supplier_id uuid,
  p_warehouse_code text,
  p_received_at timestamptz,
  p_document_code text,
  p_discount_amount numeric,
  p_vat_amount numeric,
  p_paid_amount numeric,
  p_payment_method text,
  p_note text,
  p_items jsonb,
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
  v_supplier public.suppliers%rowtype;
  v_product public.products%rowtype;
  v_balance public.inventory_balances%rowtype;
  v_purchase public.purchase_orders%rowtype;
  v_line record;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce(p_discount_amount, 0));
  v_vat numeric := greatest(0, coalesce(p_vat_amount, 0));
  v_paid numeric := greatest(0, coalesce(p_paid_amount, 0));
  v_total numeric := 0;
  v_payable numeric := 0;
  v_stock_after numeric := 0;
  v_supplier_balance numeric := 0;
  v_payment_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_purchase_code text;
  v_payment_code text;
  v_cash_code text;
  v_item_rows jsonb := '[]'::jsonb;
  v_response jsonb;
begin
  if p_actor_id is null or p_supplier_id is null then
    raise exception 'Actor and supplier are required' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Receipt must contain at least one item' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, unit_cost numeric)
    group by line.product_id
    having count(*) > 1
  ) then
    raise exception 'A product may appear only once in a receipt' using errcode = '22023';
  end if;
  if v_payment_method not in ('CASH', 'TRANSFER', 'CARD', 'OTHER') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':inventory-receipt:' || v_key));
  select response_json into v_cached
  from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_INVENTORY_RECEIPT' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_warehouse
  from public.warehouses
  where code = coalesce(nullif(btrim(p_warehouse_code), ''), 'KHO-CHINH')
    and upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
  for update;
  if not found then
    raise exception 'Warehouse is not available' using errcode = '22023';
  end if;

  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id and upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
  for update;
  if not found then
    raise exception 'Supplier is not active' using errcode = '22023';
  end if;

  for v_line in
    select line.product_id, line.quantity, line.unit_cost
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, unit_cost numeric)
    order by line.product_id
  loop
    if v_line.product_id is null or coalesce(v_line.quantity, 0) <= 0 or coalesce(v_line.unit_cost, 0) < 0 then
      raise exception 'Receipt item is invalid' using errcode = '22023';
    end if;
    select * into v_product from public.products where id = v_line.product_id for update;
    if not found or upper(coalesce(v_product.status, 'ACTIVE')) <> 'ACTIVE' then
      raise exception 'Product is not active' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + (v_line.quantity * v_line.unit_cost);
  end loop;

  v_total := greatest(0, v_subtotal - v_discount + v_vat);
  if v_paid > v_total then
    raise exception 'Paid amount exceeds receipt total' using errcode = '22023';
  end if;
  v_payable := v_total - v_paid;
  v_purchase_code := coalesce(nullif(btrim(p_document_code), ''), 'PNK' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)));

  insert into public.purchase_orders (
    code, purchase_date, supplier_id, warehouse_id, subtotal, discount_amount, vat_amount,
    total_amount, paid_amount, payable_amount, status, note
  ) values (
    v_purchase_code, coalesce(p_received_at, now()), v_supplier.id, v_warehouse.id, v_subtotal, v_discount, v_vat,
    v_total, v_paid, v_payable, 'RECEIVED', nullif(btrim(p_note), '')
  ) returning * into v_purchase;

  for v_line in
    select line.product_id, line.quantity, line.unit_cost
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, unit_cost numeric)
    order by line.product_id
  loop
    select * into v_product from public.products where id = v_line.product_id for update;
    select * into v_balance
    from public.inventory_balances
    where warehouse_id = v_warehouse.id and product_id = v_line.product_id
    for update;
    v_stock_after := coalesce(v_balance.quantity_box, 0) + v_line.quantity;

    if found then
      update public.inventory_balances
      set quantity_box = v_stock_after, updated_at = now()
      where id = v_balance.id;
    else
      insert into public.inventory_balances (warehouse_id, product_id, quantity_box, quantity_piece)
      values (v_warehouse.id, v_line.product_id, v_stock_after, 0);
    end if;

    if v_stock_after > 0 and v_line.unit_cost > 0 then
      update public.products
      set cost_price = round(((coalesce(v_balance.quantity_box, 0) * coalesce(v_product.cost_price, 0)) + (v_line.quantity * v_line.unit_cost)) / v_stock_after),
          updated_at = now()
      where id = v_product.id;
    end if;

    insert into public.purchase_order_items (purchase_id, product_id, product_code, product_name, unit, quantity, unit_cost, line_total)
    values (v_purchase.id, v_product.id, v_product.code, v_product.product_name, v_product.unit, v_line.quantity, v_line.unit_cost, v_line.quantity * v_line.unit_cost);

    insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note)
    values (v_warehouse.id, v_product.id, 'PURCHASE_IN', v_purchase.id, v_line.quantity, v_stock_after, coalesce(nullif(btrim(p_note), ''), v_purchase.code));
    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object('productId', v_product.id, 'quantity', v_line.quantity, 'unitCost', v_line.unit_cost, 'stockAfter', v_stock_after));
  end loop;

  if v_payable > 0 then
    v_supplier_balance := coalesce(v_supplier.current_payable, 0) + v_payable;
    update public.suppliers set current_payable = v_supplier_balance, updated_at = now() where id = v_supplier.id;
    insert into public.supplier_debt_ledger (supplier_id, source_type, source_id, debit, credit, balance_after, status, note)
    values (v_supplier.id, 'PURCHASE_ORDER', v_purchase.id, v_payable, 0, v_supplier_balance, 'OPEN', v_purchase.code);
  end if;

  if v_paid > 0 then
    v_payment_code := 'PC' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.payments (code, supplier_id, purchase_id, amount, payment_method, note, created_by)
    values (v_payment_code, v_supplier.id, v_purchase.id, v_paid, v_payment_method, nullif(btrim(p_note), ''), p_actor_id);
    v_cash_code := 'CQ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
    values (v_cash_code, case when v_payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'OUT', 'SUPPLIER_PAYMENT', v_purchase.id, v_paid, v_payment_method, nullif(btrim(p_note), ''), p_actor_id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREATE', 'purchase_order', v_purchase.id::text, jsonb_build_object('purchase', to_jsonb(v_purchase), 'items', v_item_rows));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'purchase', to_jsonb(v_purchase), 'items', v_item_rows);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_INVENTORY_RECEIPT', v_key, v_response);
  return v_response;
end;
$$;

create or replace function public.create_inventory_stock_out_secure(
  p_actor_id uuid,
  p_product_id uuid,
  p_warehouse_code text,
  p_quantity numeric,
  p_operation_type text,
  p_note text,
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
  v_balance public.inventory_balances%rowtype;
  v_stock_after numeric;
  v_transaction public.inventory_transactions%rowtype;
  v_response jsonb;
begin
  if p_actor_id is null or p_product_id is null or coalesce(p_quantity, 0) <= 0 then
    raise exception 'Actor, product and positive quantity are required' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':inventory-out:' || v_key));
  select response_json into v_cached from public.idempotency_keys where actor_id = p_actor_id and operation = 'CREATE_INVENTORY_STOCK_OUT' and request_key = v_key;
  if found then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_warehouse from public.warehouses where code = coalesce(nullif(btrim(p_warehouse_code), ''), 'KHO-CHINH') and upper(coalesce(status, 'ACTIVE')) = 'ACTIVE' for update;
  if not found then raise exception 'Warehouse is not available' using errcode = '22023'; end if;
  select * into v_balance from public.inventory_balances where warehouse_id = v_warehouse.id and product_id = p_product_id for update;
  if not found or coalesce(v_balance.quantity_box, 0) < p_quantity then
    raise exception 'Insufficient stock' using errcode = '22023';
  end if;

  v_stock_after := v_balance.quantity_box - p_quantity;
  update public.inventory_balances set quantity_box = v_stock_after, updated_at = now() where id = v_balance.id;
  insert into public.inventory_transactions (warehouse_id, product_id, source_type, quantity_change, stock_after, note)
  values (v_warehouse.id, p_product_id, coalesce(nullif(btrim(p_operation_type), ''), 'STOCK_OUT'), -p_quantity, v_stock_after, nullif(btrim(p_note), ''))
  returning * into v_transaction;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'OUT', 'inventory', v_transaction.id::text, to_jsonb(v_transaction));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'transaction', to_jsonb(v_transaction), 'stockAfter', v_stock_after);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_INVENTORY_STOCK_OUT', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_inventory_receipt_secure(uuid, uuid, text, timestamptz, text, numeric, numeric, numeric, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.create_inventory_stock_out_secure(uuid, uuid, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.create_inventory_receipt_secure(uuid, uuid, text, timestamptz, text, numeric, numeric, numeric, text, text, jsonb, text) to service_role;
grant execute on function public.create_inventory_stock_out_secure(uuid, uuid, text, numeric, text, text, text) to service_role;

create index if not exists inventory_transactions_product_created_idx on public.inventory_transactions(product_id, created_at desc);
create index if not exists purchase_orders_supplier_date_idx on public.purchase_orders(supplier_id, purchase_date desc);
