-- Close finance/inventory integrity gaps found by the full application audit.
-- Apply after 20260711_expense_fund_price_override.sql.

alter table public.sales_order_items add column if not exists unit_cost_snapshot numeric;
update public.sales_order_items item
set unit_cost_snapshot = coalesce(product.cost_price, 0)
from public.products product
where item.product_id = product.id and item.unit_cost_snapshot is null;
update public.sales_order_items set unit_cost_snapshot = 0 where unit_cost_snapshot is null;
alter table public.sales_order_items alter column unit_cost_snapshot set not null;

create or replace function public.capture_sales_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.unit_cost_snapshot is null then
    select coalesce(cost_price, 0) into new.unit_cost_snapshot
    from public.products where id = new.product_id;
    new.unit_cost_snapshot := coalesce(new.unit_cost_snapshot, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists sales_order_items_capture_cost on public.sales_order_items;
create trigger sales_order_items_capture_cost
before insert on public.sales_order_items
for each row execute function public.capture_sales_item_cost();

revoke all on function public.capture_sales_item_cost() from public, anon, authenticated;
grant execute on function public.capture_sales_item_cost() to service_role;

create or replace function public.adjust_customer_debt_secure(
  p_actor_id uuid,
  p_customer_id uuid,
  p_delta numeric,
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
  v_customer public.customers%rowtype;
  v_delta numeric := coalesce(p_delta, 0);
  v_balance numeric;
  v_ledger public.customer_debt_ledger%rowtype;
  v_response jsonb;
begin
  if p_actor_id is null or p_customer_id is null or v_delta = 0 or v_key is null then
    raise exception 'Actor, customer, non-zero delta and idempotency key are required' using errcode = '22023';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'Debt adjustment reason is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':customer-debt:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'ADJUST_CUSTOMER_DEBT' and request_key = v_key;
  if found then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'Customer was not found' using errcode = '22023'; end if;
  v_balance := coalesce(v_customer.current_debt, 0) + v_delta;
  if v_balance < 0 then raise exception 'Debt adjustment would make the balance negative' using errcode = '22023'; end if;

  update public.customers set current_debt = v_balance, updated_at = now() where id = p_customer_id;
  insert into public.customer_debt_ledger (
    customer_id, source_type, source_id, debit, credit, balance_after, status, note
  ) values (
    p_customer_id, 'ADJUSTMENT', gen_random_uuid(), greatest(v_delta, 0), greatest(-v_delta, 0), v_balance,
    case when v_balance > 0 then 'OPEN' else 'CLOSED' end, btrim(p_note)
  ) returning * into v_ledger;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'ADJUST_DEBT', 'customer', p_customer_id::text, jsonb_build_object('delta', v_delta, 'balanceAfter', v_balance, 'reason', btrim(p_note)));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'balanceAfter', v_balance, 'ledger', to_jsonb(v_ledger));
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'ADJUST_CUSTOMER_DEBT', v_key, v_response);
  return v_response;
end;
$$;

create or replace function public.create_supplier_payment_secure(
  p_actor_id uuid,
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_method text,
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
  v_supplier public.suppliers%rowtype;
  v_purchase public.purchase_orders%rowtype;
  v_payment public.payments%rowtype;
  v_amount numeric := greatest(0, coalesce(p_amount, 0));
  v_remaining numeric;
  v_allocation numeric;
  v_balance numeric;
  v_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_payment_code text;
  v_cash_code text;
  v_response jsonb;
begin
  if p_actor_id is null or p_supplier_id is null or v_amount <= 0 or v_key is null then
    raise exception 'Actor, supplier, positive amount and idempotency key are required' using errcode = '22023';
  end if;
  if v_method not in ('CASH', 'TRANSFER') then raise exception 'Unsupported payment method' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':supplier-payment:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_SUPPLIER_PAYMENT' and request_key = v_key;
  if found then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_supplier from public.suppliers where id = p_supplier_id for update;
  if not found or upper(coalesce(v_supplier.status, 'ACTIVE')) <> 'ACTIVE' then
    raise exception 'Supplier is not active' using errcode = '22023';
  end if;
  if v_amount > coalesce(v_supplier.current_payable, 0) then
    raise exception 'Payment exceeds supplier payable' using errcode = '22023';
  end if;

  v_payment_code := 'PC' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.payments (code, supplier_id, amount, payment_method, note, created_by)
  values (v_payment_code, p_supplier_id, v_amount, v_method, nullif(btrim(p_note), ''), p_actor_id)
  returning * into v_payment;

  v_remaining := v_amount;
  for v_purchase in
    select * from public.purchase_orders
    where supplier_id = p_supplier_id and payable_amount > 0 and status = 'RECEIVED'
    order by purchase_date asc, created_at asc for update
  loop
    exit when v_remaining <= 0;
    v_allocation := least(v_remaining, v_purchase.payable_amount);
    update public.purchase_orders
    set paid_amount = paid_amount + v_allocation,
        payable_amount = payable_amount - v_allocation,
        updated_at = now()
    where id = v_purchase.id;
    v_remaining := v_remaining - v_allocation;
  end loop;

  v_balance := coalesce(v_supplier.current_payable, 0) - v_amount;
  update public.suppliers set current_payable = v_balance, updated_at = now() where id = p_supplier_id;
  insert into public.supplier_debt_ledger (supplier_id, source_type, source_id, debit, credit, balance_after, status, note)
  values (p_supplier_id, 'PAYMENT', v_payment.id, 0, v_amount, v_balance, case when v_balance > 0 then 'OPEN' else 'CLOSED' end, coalesce(nullif(btrim(p_note), ''), v_payment.code));
  v_cash_code := 'CQ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
  values (v_cash_code, case when v_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'OUT', 'SUPPLIER_PAYMENT', v_payment.id, v_amount, v_method, nullif(btrim(p_note), ''), p_actor_id);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREATE', 'supplier_payment', v_payment.id::text, jsonb_build_object('payment', to_jsonb(v_payment), 'balanceAfter', v_balance));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'payment', to_jsonb(v_payment), 'balanceAfter', v_balance);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_SUPPLIER_PAYMENT', v_key, v_response);
  return v_response;
end;
$$;

create or replace function public.cancel_sales_order_secure(
  p_actor_id uuid,
  p_order_id uuid,
  p_reason text,
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
  v_order public.sales_orders%rowtype;
  v_customer public.customers%rowtype;
  v_debt public.order_debts%rowtype;
  v_item record;
  v_warehouse_id uuid;
  v_stock_after numeric;
  v_cash_code text;
  v_response jsonb;
begin
  if p_actor_id is null or p_order_id is null or v_key is null or nullif(btrim(p_reason), '') is null then
    raise exception 'Actor, order, reason and idempotency key are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':cancel-order:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CANCEL_SALES_ORDER' and request_key = v_key;
  if found then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then raise exception 'Order was not found' using errcode = '22023'; end if;
  if v_order.status <> 'COMPLETED' then raise exception 'Only completed orders may be cancelled' using errcode = '22023'; end if;
  select warehouse_id into v_warehouse_id from public.inventory_transactions
  where source_type = 'SALES_ORDER' and source_id = p_order_id order by created_at asc limit 1;
  if v_warehouse_id is null then raise exception 'Order warehouse could not be resolved' using errcode = '22023'; end if;

  for v_item in select product_id, sum(quantity) quantity from public.sales_order_items where order_id = p_order_id group by product_id order by product_id
  loop
    update public.inventory_balances set quantity_box = quantity_box + v_item.quantity, updated_at = now()
    where warehouse_id = v_warehouse_id and product_id = v_item.product_id returning quantity_box into v_stock_after;
    if not found then raise exception 'Inventory balance was not found for cancellation' using errcode = '22023'; end if;
    insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note)
    values (v_warehouse_id, v_item.product_id, 'SALES_CANCEL', p_order_id, v_item.quantity, v_stock_after, btrim(p_reason));
  end loop;

  if v_order.customer_id is not null then
    select * into v_customer from public.customers where id = v_order.customer_id for update;
    update public.customers
    set current_debt = greatest(0, current_debt - v_order.debt_amount),
        total_revenue = greatest(0, total_revenue - v_order.total_amount), updated_at = now()
    where id = v_order.customer_id;
    select * into v_debt from public.order_debts where order_id = p_order_id for update;
    if found then
      update public.order_debts set remaining_amount = 0, status = 'CANCELLED', closed_at = now(), updated_at = now() where id = v_debt.id;
    end if;
    if v_order.debt_amount > 0 then
      insert into public.customer_debt_ledger (customer_id, order_id, source_type, source_id, debit, credit, balance_after, status, note)
      values (v_order.customer_id, p_order_id, 'ORDER_CANCEL', p_order_id, 0, v_order.debt_amount,
        greatest(0, coalesce(v_customer.current_debt, 0) - v_order.debt_amount), 'CLOSED', btrim(p_reason));
    end if;
  end if;

  if v_order.paid_amount > 0 then
    v_cash_code := 'HT' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
    values (v_cash_code, case when v_order.payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'OUT', 'SALES_REFUND', p_order_id, v_order.paid_amount, v_order.payment_method, btrim(p_reason), p_actor_id);
  end if;
  update public.sales_orders set status = 'CANCELLED', debt_amount = 0, note = concat_ws(' - ', note, 'Hủy: ' || btrim(p_reason)), updated_at = now() where id = p_order_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json)
  values (p_actor_id, 'CANCEL', 'sales_order', p_order_id::text, to_jsonb(v_order), jsonb_build_object('reason', btrim(p_reason)));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'orderId', p_order_id, 'status', 'CANCELLED');
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CANCEL_SALES_ORDER', v_key, v_response);
  return v_response;
end;
$$;

create or replace function public.apply_inventory_count_secure(
  p_actor_id uuid,
  p_warehouse_code text,
  p_rows jsonb,
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
  v_row record;
  v_balance public.inventory_balances%rowtype;
  v_current numeric;
  v_change numeric;
  v_changed integer := 0;
  v_response jsonb;
begin
  if p_actor_id is null or v_key is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Actor, rows and idempotency key are required' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as item(product_id uuid, quantity numeric, note text) group by product_id having count(*) > 1) then
    raise exception 'A product may appear only once in a count' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':inventory-count:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'APPLY_INVENTORY_COUNT' and request_key = v_key;
  if found then return v_cached || jsonb_build_object('idempotent', true); end if;
  select * into v_warehouse from public.warehouses
  where code = coalesce(nullif(btrim(p_warehouse_code), ''), 'KHO-CHINH') and status = 'ACTIVE' for update;
  if not found then raise exception 'Warehouse is not available' using errcode = '22023'; end if;

  for v_row in select * from jsonb_to_recordset(p_rows) as item(product_id uuid, quantity numeric, note text) order by product_id
  loop
    if v_row.product_id is null or coalesce(v_row.quantity, -1) < 0 then raise exception 'Invalid count row' using errcode = '22023'; end if;
    select * into v_balance from public.inventory_balances where warehouse_id = v_warehouse.id and product_id = v_row.product_id for update;
    v_current := coalesce(v_balance.quantity_box, 0);
    v_change := v_row.quantity - v_current;
    if v_change <> 0 then
      if found then
        update public.inventory_balances set quantity_box = v_row.quantity, updated_at = now() where id = v_balance.id;
      else
        insert into public.inventory_balances (warehouse_id, product_id, quantity_box, quantity_piece) values (v_warehouse.id, v_row.product_id, v_row.quantity, 0);
      end if;
      insert into public.inventory_transactions (warehouse_id, product_id, source_type, quantity_change, stock_after, note)
      values (v_warehouse.id, v_row.product_id, 'STOCK_COUNT_SHEET', v_change, v_row.quantity, coalesce(nullif(btrim(v_row.note), ''), nullif(btrim(p_note), ''), 'Kiểm kê'));
      insert into public.inventory_edit_logs (product_id, warehouse_id, old_quantity_box, new_quantity_box, quantity_change, source_type, edited_by, approved_by, approved_at, note)
      values (v_row.product_id, v_warehouse.id, v_current, v_row.quantity, v_change, 'DIRECT_STOCK_COUNT', p_actor_id, p_actor_id, now(), coalesce(v_row.note, p_note));
      v_changed := v_changed + 1;
    end if;
  end loop;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'STOCK_COUNT_SHEET', 'inventory', 'direct', jsonb_build_object('changedRows', v_changed));
  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'status', 'APPLIED', 'changedRows', v_changed);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'APPLY_INVENTORY_COUNT', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.adjust_customer_debt_secure(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.create_supplier_payment_secure(uuid, uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_sales_order_secure(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_inventory_count_secure(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.adjust_customer_debt_secure(uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.create_supplier_payment_secure(uuid, uuid, numeric, text, text, text) to service_role;
grant execute on function public.cancel_sales_order_secure(uuid, uuid, text, text) to service_role;
grant execute on function public.apply_inventory_count_secure(uuid, text, jsonb, text, text) to service_role;
