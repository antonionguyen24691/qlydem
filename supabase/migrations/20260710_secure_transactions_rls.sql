-- PMQL production hardening: service-role transaction RPCs, idempotency, logical-delete archives and RLS.
-- Apply this migration before deploying the API code that calls the RPCs below.

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  operation text not null,
  request_key text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_id, operation, request_key)
);

create table if not exists public.history_clear_backups (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  groups text[] not null,
  row_counts jsonb not null default '{}'::jsonb,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idempotency_keys_created_at_idx on public.idempotency_keys(created_at desc);
create index if not exists history_clear_backups_created_at_idx on public.history_clear_backups(created_at desc);

insert into public.roles (role, name, permissions_json)
values
  ('ADMIN', 'Quản trị viên', '{"all": true}'::jsonb),
  ('ACCOUNTANT', 'Kế toán', '{"permissions":{"dashboard.view":"all","pos.use":"all","orders.view":"all","orders.create":"all","orders.price_override":"all","customers.view":"all","customers.create":"all","customers.update":"all","products.view":"all","inventory.view":"all","finance.view":"all","finance.receipt.create":"all","finance.export":"all"}}'::jsonb),
  ('SALE', 'Nhân viên bán hàng', '{"permissions":{"dashboard.view":"own","pos.use":"own","orders.view":"own","orders.create":"own","customers.view":"own","customers.create":"own","customers.update":"own","products.view":"all","inventory.view":"all"}}'::jsonb),
  ('WAREHOUSE', 'Kho', '{"permissions":{"dashboard.view":"own","products.view":"all","products.manage":"all","inventory.view":"all","inventory.manage":"all"}}'::jsonb),
  ('VIEWER', 'Chỉ xem', '{"permissions":{"dashboard.view":"all"}}'::jsonb)
on conflict (role) do update
set name = excluded.name,
    permissions_json = excluded.permissions_json,
    updated_at = now();

create or replace function public.create_sales_order_secure(
  p_actor_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_paid_amount numeric,
  p_discount_amount numeric,
  p_due_date date,
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
  v_product public.products%rowtype;
  v_balance public.inventory_balances%rowtype;
  v_order public.sales_orders%rowtype;
  v_receipt public.receipts%rowtype;
  v_debt public.order_debts%rowtype;
  v_line record;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce(p_discount_amount, 0));
  v_total numeric := 0;
  v_paid numeric := greatest(0, coalesce(p_paid_amount, 0));
  v_debt_amount numeric := 0;
  v_balance_after numeric := 0;
  v_payment_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_order_code text;
  v_receipt_code text;
  v_cash_code text;
  v_item_rows jsonb := '[]'::jsonb;
  v_stock_after numeric;
  v_response jsonb;
begin
  if p_actor_id is null then
    raise exception 'Actor is required' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item' using errcode = '22023';
  end if;
  if v_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':sales-order:' || v_key));
  select response_json into v_cached
  from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_SALES_ORDER' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if p_warehouse_id is null then
    select id into p_warehouse_id
    from public.warehouses
    where status = 'ACTIVE'
    order by created_at asc
    limit 1;
  end if;
  if p_warehouse_id is null then
    raise exception 'No active warehouse is configured' using errcode = '22023';
  end if;
  perform 1 from public.warehouses where id = p_warehouse_id and status = 'ACTIVE';
  if not found then
    raise exception 'Warehouse is not active' using errcode = '22023';
  end if;

  for v_line in
    select line.product_id, sum(line.quantity)::numeric as quantity
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric)
    group by line.product_id
    order by line.product_id
  loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Every order item needs a product and positive quantity' using errcode = '22023';
    end if;

    select * into v_product from public.products where id = v_line.product_id for share;
    if not found then
      raise exception 'Product % was not found', v_line.product_id using errcode = '22023';
    end if;
    if upper(coalesce(v_product.status, 'ACTIVE')) in ('HOLD', 'DISCONTINUED', 'INACTIVE')
       or upper(coalesce(v_product.lifecycle_status, 'ACTIVE')) in ('HOLD', 'DISCONTINUED', 'INACTIVE') then
      raise exception 'Product % is not available for sale', v_product.code using errcode = '22023';
    end if;

    select * into v_balance
    from public.inventory_balances
    where warehouse_id = p_warehouse_id and product_id = v_line.product_id
    for update;
    if not found or coalesce(v_balance.quantity_box, 0) < v_line.quantity then
      raise exception 'Insufficient stock for product %', v_product.code using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + v_line.quantity * greatest(0, coalesce(v_product.sell_price_box_vat, v_product.price_by_m2, 0));
    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_code', v_product.code,
      'product_name', coalesce(nullif(v_product.invoice_name, ''), v_product.product_name, v_product.code),
      'unit', v_product.unit,
      'quantity', v_line.quantity,
      'unit_price', greatest(0, coalesce(v_product.sell_price_box_vat, v_product.price_by_m2, 0)),
      'line_total', v_line.quantity * greatest(0, coalesce(v_product.sell_price_box_vat, v_product.price_by_m2, 0))
    ));
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot exceed order subtotal' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount;
  v_paid := least(v_paid, v_total);
  v_debt_amount := v_total - v_paid;

  if p_customer_id is null and v_debt_amount > 0 then
    raise exception 'A customer is required for a debt order' using errcode = '22023';
  end if;
  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id for update;
    if not found or upper(coalesce(v_customer.status, 'ACTIVE')) <> 'ACTIVE' then
      raise exception 'Customer is not active' using errcode = '22023';
    end if;
    if v_debt_amount > 0 and coalesce(v_customer.credit_limit, 0) > 0
       and coalesce(v_customer.current_debt, 0) + v_debt_amount > v_customer.credit_limit then
      raise exception 'Customer credit limit would be exceeded' using errcode = '22023';
    end if;
  end if;

  v_order_code := 'HD' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.sales_orders (
    code, customer_id, sale_id, subtotal, discount_amount, vat_amount, total_amount,
    paid_amount, debt_amount, payment_method, status, note
  ) values (
    v_order_code, p_customer_id, p_actor_id, v_subtotal, v_discount, 0, v_total,
    v_paid, v_debt_amount, case when v_debt_amount > 0 and v_paid = 0 then 'DEBT' else v_payment_method end, 'COMPLETED', nullif(btrim(p_note), '')
  ) returning * into v_order;

  for v_line in select * from jsonb_to_recordset(v_item_rows) as item(
    product_id uuid, product_code text, product_name text, unit text, quantity numeric, unit_price numeric, line_total numeric
  )
  loop
    insert into public.sales_order_items (
      order_id, product_id, product_code, product_name, unit, quantity, unit_price, discount_amount, vat_rate, line_total
    ) values (
      v_order.id, v_line.product_id, v_line.product_code, v_line.product_name, v_line.unit, v_line.quantity, v_line.unit_price, 0, 0, v_line.line_total
    );

    update public.inventory_balances
    set quantity_box = quantity_box - v_line.quantity,
        updated_at = now()
    where warehouse_id = p_warehouse_id
      and product_id = v_line.product_id
      and quantity_box >= v_line.quantity
    returning quantity_box into v_stock_after;
    if not found then
      raise exception 'Stock changed while creating order for product %', v_line.product_code using errcode = '40001';
    end if;

    insert into public.inventory_transactions (
      warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note
    ) values (
      p_warehouse_id, v_line.product_id, 'SALES_ORDER', v_order.id, -v_line.quantity, v_stock_after, 'Xuất bán đơn ' || v_order.code
    );
  end loop;

  if p_customer_id is not null then
    v_balance_after := coalesce(v_customer.current_debt, 0) + v_total;
    insert into public.order_debts (
      order_id, customer_id, sale_id, original_amount, paid_amount, remaining_amount, due_date, status, assigned_to, closed_at
    ) values (
      v_order.id, p_customer_id, p_actor_id, v_total, v_paid, v_debt_amount, p_due_date,
      case when v_debt_amount > 0 then 'OPEN' else 'CLOSED' end, p_actor_id,
      case when v_debt_amount = 0 then now() else null end
    ) returning * into v_debt;

    insert into public.customer_debt_ledger (
      customer_id, order_id, source_type, source_id, debit, credit, balance_after, due_date, status, note
    ) values (
      p_customer_id, v_order.id, 'INVOICE', v_order.id, v_total, 0, v_balance_after, p_due_date,
      case when v_debt_amount > 0 then 'OPEN' else 'CLOSED' end, 'Ghi nhận đơn ' || v_order.code
    );

    if v_paid > 0 then
      v_receipt_code := 'PT' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
      insert into public.receipts (code, customer_id, order_id, amount, payment_method, note, created_by)
      values (v_receipt_code, p_customer_id, v_order.id, v_paid, v_payment_method, 'Thu tiền đơn ' || v_order.code, p_actor_id)
      returning * into v_receipt;

      insert into public.receipt_allocations (receipt_id, order_debt_id, order_id, customer_id, amount, allocated_by)
      values (v_receipt.id, v_debt.id, v_order.id, p_customer_id, v_paid, p_actor_id);

      v_balance_after := v_balance_after - v_paid;
      insert into public.customer_debt_ledger (
        customer_id, order_id, source_type, source_id, debit, credit, balance_after, due_date, status, note
      ) values (
        p_customer_id, v_order.id, 'RECEIPT', v_receipt.id, 0, v_paid, v_balance_after, p_due_date,
        case when v_debt_amount > 0 then 'OPEN' else 'CLOSED' end, 'Thu tiền đơn ' || v_order.code
      );
    end if;

    update public.customers
    set current_debt = coalesce(v_customer.current_debt, 0) + v_debt_amount,
        total_revenue = coalesce(total_revenue, 0) + v_total,
        last_order_at = now(),
        updated_at = now()
    where id = p_customer_id;

    if v_debt_amount > 0 then
      insert into public.debt_reminders (
        order_debt_id, customer_id, assigned_to, reminder_type, channel, scheduled_at, status, title, message, created_by
      ) values (
        v_debt.id, p_customer_id, p_actor_id, 'DEBT_DUE', 'APP', coalesce(p_due_date::timestamptz, now()), 'PENDING',
        'Nhắc công nợ ' || v_order.code, 'Khách hàng còn nợ ' || to_char(v_debt_amount, 'FM999G999G999G999G990D00') || ' đ từ đơn ' || v_order.code, p_actor_id
      );
    end if;
  end if;

  if v_paid > 0 then
    v_cash_code := 'TM' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.cashbook_entries (
      code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by
    ) values (
      v_cash_code, case when v_payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'IN',
      case when p_customer_id is null then 'SALES_ORDER' else 'RECEIPT' end,
      case when p_customer_id is null then v_order.id else v_receipt.id end,
      v_paid, v_payment_method, 'Thu tiền đơn ' || v_order.code, p_actor_id
    );
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREATE', 'sales_order', v_order.id::text, jsonb_build_object('order', to_jsonb(v_order), 'items', v_item_rows));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'order', to_jsonb(v_order), 'items', v_item_rows, 'debt', to_jsonb(v_debt), 'receipt', to_jsonb(v_receipt));
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_SALES_ORDER', v_key, v_response);
  return v_response;
end;
$$;

create or replace function public.create_receipt_secure(
  p_actor_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_allocations jsonb,
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
  v_receipt public.receipts%rowtype;
  v_debt public.order_debts%rowtype;
  v_input record;
  v_amount numeric := greatest(0, coalesce(p_amount, 0));
  v_remaining numeric;
  v_allocation numeric;
  v_payment_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_receipt_code text;
  v_cash_code text;
  v_rows jsonb := '[]'::jsonb;
  v_response jsonb;
begin
  if p_actor_id is null or p_customer_id is null then
    raise exception 'Actor and customer are required' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'Receipt amount must be positive' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if v_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':receipt:' || v_key));
  select response_json into v_cached
  from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_RECEIPT' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found or upper(coalesce(v_customer.status, 'ACTIVE')) <> 'ACTIVE' then
    raise exception 'Customer is not active' using errcode = '22023';
  end if;
  if v_amount > coalesce(v_customer.current_debt, 0) then
    raise exception 'Receipt amount exceeds current customer debt' using errcode = '22023';
  end if;

  v_receipt_code := 'PT' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.receipts (code, customer_id, amount, payment_method, note, created_by)
  values (v_receipt_code, p_customer_id, v_amount, v_payment_method, nullif(btrim(p_note), ''), p_actor_id)
  returning * into v_receipt;

  v_remaining := v_amount;
  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' and jsonb_array_length(p_allocations) > 0 then
    for v_input in
      select allocation.order_debt_id, allocation.amount
      from jsonb_to_recordset(p_allocations) as allocation(order_debt_id uuid, amount numeric)
      order by allocation.order_debt_id
    loop
      if v_input.order_debt_id is null or v_input.amount is null or v_input.amount <= 0 then
        raise exception 'Receipt allocation is invalid' using errcode = '22023';
      end if;
      select * into v_debt
      from public.order_debts
      where id = v_input.order_debt_id and customer_id = p_customer_id and status in ('OPEN', 'PARTIAL')
      for update;
      if not found then
        raise exception 'Debt allocation is not available for this customer' using errcode = '22023';
      end if;
      if v_input.amount > v_remaining or v_input.amount > v_debt.remaining_amount then
        raise exception 'Receipt allocation exceeds the remaining debt' using errcode = '22023';
      end if;
      v_allocation := v_input.amount;
      update public.order_debts
      set paid_amount = paid_amount + v_allocation,
          remaining_amount = remaining_amount - v_allocation,
          status = case when remaining_amount - v_allocation > 0 then 'PARTIAL' else 'CLOSED' end,
          closed_at = case when remaining_amount - v_allocation > 0 then null else now() end,
          updated_at = now()
      where id = v_debt.id;
      update public.sales_orders
      set paid_amount = least(total_amount, paid_amount + v_allocation),
          debt_amount = greatest(0, debt_amount - v_allocation),
          updated_at = now()
      where id = v_debt.order_id;
      insert into public.receipt_allocations (receipt_id, order_debt_id, order_id, customer_id, amount, allocated_by)
      values (v_receipt.id, v_debt.id, v_debt.order_id, p_customer_id, v_allocation, p_actor_id);
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('orderDebtId', v_debt.id, 'orderId', v_debt.order_id, 'amount', v_allocation));
      v_remaining := v_remaining - v_allocation;
    end loop;
  else
    for v_debt in
      select * from public.order_debts
      where customer_id = p_customer_id and status in ('OPEN', 'PARTIAL') and remaining_amount > 0
      order by due_date asc nulls last, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_allocation := least(v_remaining, v_debt.remaining_amount);
      update public.order_debts
      set paid_amount = paid_amount + v_allocation,
          remaining_amount = remaining_amount - v_allocation,
          status = case when remaining_amount - v_allocation > 0 then 'PARTIAL' else 'CLOSED' end,
          closed_at = case when remaining_amount - v_allocation > 0 then null else now() end,
          updated_at = now()
      where id = v_debt.id;
      update public.sales_orders
      set paid_amount = least(total_amount, paid_amount + v_allocation),
          debt_amount = greatest(0, debt_amount - v_allocation),
          updated_at = now()
      where id = v_debt.order_id;
      insert into public.receipt_allocations (receipt_id, order_debt_id, order_id, customer_id, amount, allocated_by)
      values (v_receipt.id, v_debt.id, v_debt.order_id, p_customer_id, v_allocation, p_actor_id);
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('orderDebtId', v_debt.id, 'orderId', v_debt.order_id, 'amount', v_allocation));
      v_remaining := v_remaining - v_allocation;
    end loop;
  end if;

  if v_remaining <> 0 then
    raise exception 'Receipt could not be fully allocated to open customer debt' using errcode = '22023';
  end if;

  update public.customers
  set current_debt = current_debt - v_amount,
      updated_at = now()
  where id = p_customer_id;

  insert into public.customer_debt_ledger (customer_id, source_type, source_id, debit, credit, balance_after, status, note)
  values (p_customer_id, 'RECEIPT', v_receipt.id, 0, v_amount, v_customer.current_debt - v_amount, 'CLOSED', coalesce(nullif(btrim(p_note), ''), 'Thu tiền khách hàng'));

  v_cash_code := 'TM' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
  values (v_cash_code, case when v_payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'IN', 'RECEIPT', v_receipt.id, v_amount, v_payment_method, nullif(btrim(p_note), ''), p_actor_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREATE', 'receipt', v_receipt.id::text, jsonb_build_object('receipt', to_jsonb(v_receipt), 'allocations', v_rows));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'receipt', to_jsonb(v_receipt), 'allocations', v_rows, 'unallocatedAmount', 0);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_RECEIPT', v_key, v_response);
  return v_response;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'users', 'roles', 'settings', 'customers', 'suppliers', 'products', 'product_status_history',
    'price_update_requests', 'price_update_request_items', 'price_edit_logs', 'warehouses', 'inventory_balances',
    'sales_orders', 'sales_order_items', 'purchase_orders', 'purchase_order_items', 'receipts', 'payments',
    'customer_debt_ledger', 'order_debts', 'receipt_allocations', 'debt_assignments', 'debt_reminders',
    'debt_reminder_logs', 'payment_promises', 'customer_contacts', 'supplier_debt_ledger', 'inventory_transactions',
    'inventory_adjustment_requests', 'inventory_adjustment_request_items', 'inventory_edit_logs', 'cashbook_entries',
    'notifications', 'import_batches', 'import_errors', 'audit_logs', 'idempotency_keys', 'history_clear_backups'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text) from public, anon, authenticated;
revoke all on function public.create_receipt_secure(uuid, uuid, numeric, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text) to service_role;
grant execute on function public.create_receipt_secure(uuid, uuid, numeric, text, text, jsonb, text) to service_role;
