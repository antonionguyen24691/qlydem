-- Trả hàng một phần + số dư khách hàng (store credit).
-- Apply after 20260718_google_sheets_change_inbox.sql.
--
-- 1) customers.credit_balance + sổ customer_credit_ledger
-- 2) create_receipt_secure: cho phép thu vượt nợ, phần thừa vào số dư
-- 3) create_sales_order_secure: thêm p_credit_amount (dùng số dư trả trước)
-- 4) create_sales_return_secure: trả hàng một phần, hàng lỗi vào KHO-LOI,
--    hoàn tiền theo CASH/TRANSFER/CREDIT/DEBT_OFFSET
-- 5) withdraw_customer_credit_secure: rút số dư trả lại khách

-- ============================================================
-- 1. Số dư khách hàng
-- ============================================================

alter table public.customers
  add column if not exists credit_balance numeric not null default 0;

create table if not exists public.customer_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  direction text not null check (direction in ('IN', 'OUT')),
  amount numeric not null check (amount > 0),
  balance_after numeric not null,
  source_type text not null check (source_type in ('OVERPAYMENT', 'RETURN_REFUND', 'ORDER_PAYMENT', 'CREDIT_WITHDRAW', 'ADJUST')),
  source_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists customer_credit_ledger_customer_idx
  on public.customer_credit_ledger(customer_id, created_at desc);

-- ============================================================
-- 2. Phiếu trả hàng
-- ============================================================

alter table public.sales_orders
  add column if not exists returned_amount numeric not null default 0;

create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  order_id uuid not null references public.sales_orders(id),
  customer_id uuid references public.customers(id),
  total_amount numeric not null default 0,
  refund_method text not null check (refund_method in ('CASH', 'TRANSFER', 'CREDIT', 'DEBT_OFFSET')),
  refund_cash_amount numeric not null default 0,
  debt_offset_amount numeric not null default 0,
  credit_amount numeric not null default 0,
  reason_code text not null check (reason_code in ('HANG_LOI', 'HANG_DU', 'GIAO_NHAM', 'KHAC')),
  reason text,
  note text,
  status text not null default 'COMPLETED',
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists sales_returns_order_idx on public.sales_returns(order_id, created_at desc);
create index if not exists sales_returns_customer_idx on public.sales_returns(customer_id, created_at desc);

create table if not exists public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sales_returns(id) on delete cascade,
  order_id uuid not null references public.sales_orders(id),
  product_id uuid not null references public.products(id),
  product_name text,
  unit text,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  condition text not null check (condition in ('GOOD', 'DEFECTIVE')),
  warehouse_id uuid references public.warehouses(id),
  created_at timestamptz not null default now()
);

create index if not exists sales_return_items_return_idx on public.sales_return_items(return_id);
create index if not exists sales_return_items_order_idx on public.sales_return_items(order_id, product_id);

do $$
declare
  v_table text;
begin
  foreach v_table in array array['customer_credit_ledger', 'sales_returns', 'sales_return_items']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

-- ============================================================
-- 3. Phiếu thu: cho phép thu vượt nợ, phần thừa vào số dư
-- ============================================================

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
  v_allocated numeric := 0;
  v_allocation numeric;
  v_credit_added numeric := 0;
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

  v_allocated := v_amount - v_remaining;
  v_credit_added := v_remaining;

  if v_allocated > 0 then
    update public.customers
    set current_debt = current_debt - v_allocated,
        updated_at = now()
    where id = p_customer_id;

    insert into public.customer_debt_ledger (customer_id, source_type, source_id, debit, credit, balance_after, status, note)
    values (p_customer_id, 'RECEIPT', v_receipt.id, 0, v_allocated, v_customer.current_debt - v_allocated, 'CLOSED', coalesce(nullif(btrim(p_note), ''), 'Thu tiền khách hàng'));
  end if;

  -- Phần thu vượt nợ: cộng vào số dư của khách (khách gửi tiền trước).
  if v_credit_added > 0 then
    update public.customers
    set credit_balance = coalesce(credit_balance, 0) + v_credit_added,
        updated_at = now()
    where id = p_customer_id;

    insert into public.customer_credit_ledger (customer_id, direction, amount, balance_after, source_type, source_id, note, created_by)
    values (p_customer_id, 'IN', v_credit_added, coalesce(v_customer.credit_balance, 0) + v_credit_added, 'OVERPAYMENT', v_receipt.id,
      coalesce(nullif(btrim(p_note), ''), 'Thu vượt công nợ - cộng số dư'), p_actor_id);
  end if;

  v_cash_code := 'TM' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
  values (v_cash_code, case when v_payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'IN', 'RECEIPT', v_receipt.id, v_amount, v_payment_method, nullif(btrim(p_note), ''), p_actor_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREATE', 'receipt', v_receipt.id::text,
    jsonb_build_object('receipt', to_jsonb(v_receipt), 'allocations', v_rows, 'creditAdded', v_credit_added));

  v_response := jsonb_build_object(
    'ok', true, 'idempotent', false, 'receipt', to_jsonb(v_receipt), 'allocations', v_rows,
    'unallocatedAmount', 0, 'creditAdded', v_credit_added
  );
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_RECEIPT', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_receipt_secure(uuid, uuid, numeric, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_receipt_secure(uuid, uuid, numeric, text, text, jsonb, text) to service_role;

-- ============================================================
-- 4. Tạo đơn: thêm p_credit_amount (thanh toán bằng số dư)
-- ============================================================

drop function if exists public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text, boolean);

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
  p_idempotency_key text,
  p_allow_price_override boolean default false,
  p_credit_amount numeric default 0
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
  v_credit numeric := greatest(0, coalesce(p_credit_amount, 0));
  v_total_paid numeric := 0;
  v_debt_amount numeric := 0;
  v_balance_after numeric := 0;
  v_payment_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_order_code text;
  v_receipt_code text;
  v_cash_code text;
  v_item_rows jsonb := '[]'::jsonb;
  v_stock_after numeric;
  v_line_price numeric;
  v_line_unit text;
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
  if v_credit > 0 and p_customer_id is null then
    raise exception 'Store credit requires a customer' using errcode = '22023';
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
    select line.product_id,
           sum(line.quantity)::numeric as quantity,
           max(line.unit_price) as unit_price,
           max(nullif(btrim(line.unit), '')) as unit
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, unit_price numeric, unit text)
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

    v_line_price := greatest(0, coalesce(v_product.sell_price_box_vat, v_product.price_by_m2, 0));
    if p_allow_price_override and v_line.unit_price is not null and v_line.unit_price >= 0 then
      v_line_price := v_line.unit_price;
    end if;
    v_line_unit := v_product.unit;
    if p_allow_price_override and v_line.unit is not null then
      v_line_unit := v_line.unit;
    end if;

    v_subtotal := v_subtotal + v_line.quantity * v_line_price;
    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_code', v_product.code,
      'product_name', coalesce(nullif(v_product.invoice_name, ''), v_product.product_name, v_product.code),
      'unit', v_line_unit,
      'quantity', v_line.quantity,
      'unit_price', v_line_price,
      'line_total', v_line.quantity * v_line_price
    ));
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot exceed order subtotal' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount;
  v_credit := least(v_credit, v_total);
  v_paid := least(v_paid, v_total - v_credit);
  v_total_paid := v_paid + v_credit;
  v_debt_amount := v_total - v_total_paid;

  if p_customer_id is null and v_debt_amount > 0 then
    raise exception 'A customer is required for a debt order' using errcode = '22023';
  end if;
  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id for update;
    if not found or upper(coalesce(v_customer.status, 'ACTIVE')) <> 'ACTIVE' then
      raise exception 'Customer is not active' using errcode = '22023';
    end if;
    if v_credit > coalesce(v_customer.credit_balance, 0) then
      raise exception 'Store credit amount exceeds customer credit balance' using errcode = '22023';
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
    v_total_paid, v_debt_amount, case when v_debt_amount > 0 and v_total_paid = 0 then 'DEBT' else v_payment_method end, 'COMPLETED', nullif(btrim(p_note), '')
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
      v_order.id, p_customer_id, p_actor_id, v_total, v_total_paid, v_debt_amount, p_due_date,
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

    -- Thanh toán bằng số dư: trừ credit_balance, không ghi sổ quỹ
    -- (tiền mặt đã vào quỹ từ lúc khách gửi/trả thừa).
    if v_credit > 0 then
      update public.customers
      set credit_balance = coalesce(credit_balance, 0) - v_credit,
          updated_at = now()
      where id = p_customer_id;

      insert into public.customer_credit_ledger (customer_id, direction, amount, balance_after, source_type, source_id, note, created_by)
      values (p_customer_id, 'OUT', v_credit, coalesce(v_customer.credit_balance, 0) - v_credit, 'ORDER_PAYMENT', v_order.id,
        'Dùng số dư thanh toán đơn ' || v_order.code, p_actor_id);

      v_balance_after := v_balance_after - v_credit;
      insert into public.customer_debt_ledger (
        customer_id, order_id, source_type, source_id, debit, credit, balance_after, due_date, status, note
      ) values (
        p_customer_id, v_order.id, 'CREDIT_USE', v_order.id, 0, v_credit, v_balance_after, p_due_date,
        case when v_debt_amount > 0 then 'OPEN' else 'CLOSED' end, 'Trừ số dư đơn ' || v_order.code
      );
    end if;

    update public.customers
    set current_debt = coalesce(current_debt, 0) + v_debt_amount,
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
  values (p_actor_id, 'CREATE', 'sales_order', v_order.id::text,
    jsonb_build_object('order', to_jsonb(v_order), 'items', v_item_rows, 'priceOverride', p_allow_price_override, 'creditUsed', v_credit));

  v_response := jsonb_build_object(
    'ok', true, 'idempotent', false, 'order', to_jsonb(v_order), 'items', v_item_rows,
    'debt', to_jsonb(v_debt), 'receipt', to_jsonb(v_receipt), 'creditUsed', v_credit
  );
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_SALES_ORDER', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text, boolean, numeric) from public, anon, authenticated;
grant execute on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text, boolean, numeric) to service_role;

-- ============================================================
-- 5. Trả hàng một phần
-- ============================================================

create or replace function public.create_sales_return_secure(
  p_actor_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_reason_code text,
  p_reason text,
  p_refund_method text,
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
  v_order public.sales_orders%rowtype;
  v_customer public.customers%rowtype;
  v_order_debt public.order_debts%rowtype;
  v_debt public.order_debts%rowtype;
  v_return public.sales_returns%rowtype;
  v_line record;
  v_sold record;
  v_reason_code text := upper(coalesce(nullif(btrim(p_reason_code), ''), 'KHAC'));
  v_refund_method text := upper(coalesce(nullif(btrim(p_refund_method), ''), 'CASH'));
  v_sale_warehouse_id uuid;
  v_defect_warehouse_id uuid;
  v_target_warehouse_id uuid;
  v_refund_total numeric := 0;
  v_debt_offset numeric := 0;
  v_cash_refund numeric := 0;
  v_credit_refund numeric := 0;
  v_rest numeric := 0;
  v_allocation numeric := 0;
  v_stock_after numeric;
  v_return_code text;
  v_cash_code text;
  v_item_rows jsonb := '[]'::jsonb;
  v_total_sold numeric := 0;
  v_total_returned numeric := 0;
  v_fully_returned boolean;
  v_response jsonb;
begin
  if p_actor_id is null or p_order_id is null then
    raise exception 'Actor and order are required' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Return must contain at least one item' using errcode = '22023';
  end if;
  if v_reason_code not in ('HANG_LOI', 'HANG_DU', 'GIAO_NHAM', 'KHAC') then
    raise exception 'Unsupported return reason' using errcode = '22023';
  end if;
  if v_refund_method not in ('CASH', 'TRANSFER', 'CREDIT', 'DEBT_OFFSET') then
    raise exception 'Unsupported refund method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':sales-return:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'CREATE_SALES_RETURN' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order was not found' using errcode = '22023';
  end if;
  if v_order.status <> 'COMPLETED' then
    raise exception 'Only completed orders may be returned' using errcode = '22023';
  end if;
  if v_order.customer_id is null and v_refund_method in ('CREDIT', 'DEBT_OFFSET') then
    raise exception 'Retail orders only support cash or transfer refunds' using errcode = '22023';
  end if;

  select warehouse_id into v_sale_warehouse_id from public.inventory_transactions
  where source_type = 'SALES_ORDER' and source_id = p_order_id
  order by created_at asc limit 1;
  if v_sale_warehouse_id is null then
    raise exception 'Order warehouse could not be resolved' using errcode = '22023';
  end if;

  if v_order.customer_id is not null then
    select * into v_customer from public.customers where id = v_order.customer_id for update;
  end if;

  v_return_code := 'TH' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.sales_returns (code, order_id, customer_id, refund_method, reason_code, reason, note, created_by)
  values (v_return_code, p_order_id, v_order.customer_id, v_refund_method, v_reason_code, nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), p_actor_id)
  returning * into v_return;

  for v_line in
    select line.product_id,
           upper(coalesce(nullif(btrim(line.condition), ''), 'GOOD')) as condition,
           sum(line.quantity)::numeric as quantity
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, condition text)
    group by line.product_id, upper(coalesce(nullif(btrim(line.condition), ''), 'GOOD'))
    order by line.product_id
  loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Every return item needs a product and positive quantity' using errcode = '22023';
    end if;
    if v_line.condition not in ('GOOD', 'DEFECTIVE') then
      raise exception 'Return item condition must be GOOD or DEFECTIVE' using errcode = '22023';
    end if;

    -- Số đã bán và đơn giá của sản phẩm này trong đơn.
    select coalesce(sum(quantity), 0) as sold_quantity,
           max(unit_price) as unit_price,
           max(product_name) as product_name,
           max(unit) as unit
    into v_sold
    from public.sales_order_items
    where order_id = p_order_id and product_id = v_line.product_id;
    if coalesce(v_sold.sold_quantity, 0) <= 0 then
      raise exception 'Product % is not part of this order', v_line.product_id using errcode = '22023';
    end if;

    -- Đã trả trước đó (mọi phiếu trả trước, kể cả dòng vừa ghi trong phiếu này).
    select coalesce(sum(sri.quantity), 0) into v_total_returned
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.return_id
    where sri.order_id = p_order_id and sri.product_id = v_line.product_id and sr.status = 'COMPLETED';
    if v_total_returned + v_line.quantity > v_sold.sold_quantity then
      raise exception 'Return quantity exceeds sold quantity for product %', v_line.product_id using errcode = '22023';
    end if;

    -- Hàng tốt về kho bán; hàng lỗi vào KHO-LOI.
    if v_line.condition = 'DEFECTIVE' then
      if v_defect_warehouse_id is null then
        select id into v_defect_warehouse_id from public.warehouses where code = 'KHO-LOI';
        if v_defect_warehouse_id is null then
          insert into public.warehouses (code, name, status)
          values ('KHO-LOI', 'Kho hàng lỗi', 'ACTIVE')
          returning id into v_defect_warehouse_id;
        end if;
      end if;
      v_target_warehouse_id := v_defect_warehouse_id;
    else
      v_target_warehouse_id := v_sale_warehouse_id;
    end if;

    insert into public.inventory_balances (warehouse_id, product_id, quantity_box, quantity_piece, updated_at)
    values (v_target_warehouse_id, v_line.product_id, v_line.quantity, 0, now())
    on conflict (warehouse_id, product_id)
    do update set quantity_box = public.inventory_balances.quantity_box + excluded.quantity_box, updated_at = now()
    returning quantity_box into v_stock_after;

    insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note)
    values (v_target_warehouse_id, v_line.product_id, 'SALES_RETURN', v_return.id, v_line.quantity, v_stock_after,
      'Trả hàng ' || v_return.code || ' (' || v_reason_code || case when v_line.condition = 'DEFECTIVE' then ' - hàng lỗi' else '' end || ')');

    insert into public.sales_return_items (return_id, order_id, product_id, product_name, unit, quantity, unit_price, line_total, condition, warehouse_id)
    values (v_return.id, p_order_id, v_line.product_id, v_sold.product_name, v_sold.unit, v_line.quantity,
      coalesce(v_sold.unit_price, 0), v_line.quantity * coalesce(v_sold.unit_price, 0), v_line.condition, v_target_warehouse_id);

    v_refund_total := v_refund_total + v_line.quantity * coalesce(v_sold.unit_price, 0);
    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object(
      'productId', v_line.product_id, 'productName', v_sold.product_name, 'quantity', v_line.quantity,
      'unitPrice', coalesce(v_sold.unit_price, 0), 'lineTotal', v_line.quantity * coalesce(v_sold.unit_price, 0),
      'condition', v_line.condition
    ));
  end loop;

  if v_refund_total <= 0 then
    raise exception 'Return refund amount must be positive' using errcode = '22023';
  end if;

  v_rest := v_refund_total;

  -- (a) Trừ trước phần nợ còn lại của chính đơn này.
  if v_order.customer_id is not null then
    select * into v_order_debt from public.order_debts where order_id = p_order_id for update;
    if found and v_order_debt.status in ('OPEN', 'PARTIAL') and v_order_debt.remaining_amount > 0 then
      v_allocation := least(v_rest, v_order_debt.remaining_amount);
      if v_allocation > 0 then
        update public.order_debts
        set remaining_amount = remaining_amount - v_allocation,
            original_amount = greatest(0, original_amount - v_allocation),
            status = case when remaining_amount - v_allocation > 0 then 'PARTIAL' else 'CLOSED' end,
            closed_at = case when remaining_amount - v_allocation > 0 then null else now() end,
            updated_at = now()
        where id = v_order_debt.id;

        update public.customers
        set current_debt = greatest(0, coalesce(current_debt, 0) - v_allocation), updated_at = now()
        where id = v_order.customer_id;

        insert into public.customer_debt_ledger (customer_id, order_id, source_type, source_id, debit, credit, balance_after, status, note)
        values (v_order.customer_id, p_order_id, 'SALES_RETURN', v_return.id, 0, v_allocation,
          greatest(0, coalesce(v_customer.current_debt, 0) - v_allocation),
          case when v_order_debt.remaining_amount - v_allocation > 0 then 'OPEN' else 'CLOSED' end,
          'Trả hàng ' || v_return.code || ' - cấn nợ đơn ' || v_order.code);

        v_debt_offset := v_debt_offset + v_allocation;
        v_rest := v_rest - v_allocation;
        v_customer.current_debt := greatest(0, coalesce(v_customer.current_debt, 0) - v_allocation);
      end if;
    end if;
  end if;

  -- (b) Phần còn lại theo phương thức hoàn.
  if v_rest > 0 then
    if v_refund_method = 'DEBT_OFFSET' and v_order.customer_id is not null then
      for v_debt in
        select * from public.order_debts
        where customer_id = v_order.customer_id and status in ('OPEN', 'PARTIAL') and remaining_amount > 0 and order_id <> p_order_id
        order by due_date asc nulls last, created_at asc
        for update
      loop
        exit when v_rest <= 0;
        v_allocation := least(v_rest, v_debt.remaining_amount);
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
        update public.customers
        set current_debt = greatest(0, coalesce(current_debt, 0) - v_allocation), updated_at = now()
        where id = v_order.customer_id;
        insert into public.customer_debt_ledger (customer_id, order_id, source_type, source_id, debit, credit, balance_after, status, note)
        values (v_order.customer_id, v_debt.order_id, 'SALES_RETURN', v_return.id, 0, v_allocation,
          greatest(0, coalesce(v_customer.current_debt, 0) - v_allocation),
          case when v_debt.remaining_amount - v_allocation > 0 then 'OPEN' else 'CLOSED' end,
          'Trả hàng ' || v_return.code || ' - cấn nợ đơn khác');
        v_debt_offset := v_debt_offset + v_allocation;
        v_rest := v_rest - v_allocation;
        v_customer.current_debt := greatest(0, coalesce(v_customer.current_debt, 0) - v_allocation);
      end loop;
      -- Hết nợ mà vẫn còn dư -> chuyển vào số dư.
      if v_rest > 0 then
        v_credit_refund := v_rest;
      end if;
    elsif v_refund_method = 'CREDIT' then
      v_credit_refund := v_rest;
    else
      v_cash_refund := v_rest;
    end if;
    v_rest := 0;
  end if;

  if v_credit_refund > 0 and v_order.customer_id is not null then
    update public.customers
    set credit_balance = coalesce(credit_balance, 0) + v_credit_refund, updated_at = now()
    where id = v_order.customer_id;
    insert into public.customer_credit_ledger (customer_id, direction, amount, balance_after, source_type, source_id, note, created_by)
    values (v_order.customer_id, 'IN', v_credit_refund, coalesce(v_customer.credit_balance, 0) + v_credit_refund,
      'RETURN_REFUND', v_return.id, 'Hoàn tiền trả hàng ' || v_return.code, p_actor_id);
  end if;

  if v_cash_refund > 0 then
    v_cash_code := 'HT' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
    values (v_cash_code, case when v_refund_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'OUT', 'SALES_REFUND', v_return.id,
      v_cash_refund, case when v_refund_method = 'TRANSFER' then 'TRANSFER' else 'CASH' end,
      'Hoàn tiền trả hàng ' || v_return.code || ' (đơn ' || v_order.code || ')', p_actor_id);
  end if;

  -- Đơn đã trả hết toàn bộ số lượng?
  select coalesce(sum(quantity), 0) into v_total_sold from public.sales_order_items where order_id = p_order_id;
  select coalesce(sum(sri.quantity), 0) into v_total_returned
  from public.sales_return_items sri
  join public.sales_returns sr on sr.id = sri.return_id
  where sri.order_id = p_order_id and sr.status = 'COMPLETED';
  v_fully_returned := v_total_returned >= v_total_sold;

  update public.sales_orders
  set returned_amount = coalesce(returned_amount, 0) + v_refund_total,
      status = case when v_fully_returned then 'RETURNED' else status end,
      note = concat_ws(' - ', note, 'Trả hàng ' || v_return.code),
      updated_at = now()
  where id = p_order_id;

  update public.sales_returns
  set total_amount = v_refund_total,
      refund_cash_amount = v_cash_refund,
      debt_offset_amount = v_debt_offset,
      credit_amount = v_credit_refund
  where id = v_return.id
  returning * into v_return;

  if v_order.customer_id is not null then
    update public.customers
    set total_revenue = greatest(0, coalesce(total_revenue, 0) - v_refund_total), updated_at = now()
    where id = v_order.customer_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json)
  values (p_actor_id, 'SALES_RETURN', 'sales_order', p_order_id::text, to_jsonb(v_order),
    jsonb_build_object('return', to_jsonb(v_return), 'items', v_item_rows));

  v_response := jsonb_build_object(
    'ok', true, 'idempotent', false, 'return', to_jsonb(v_return), 'items', v_item_rows,
    'refundTotal', v_refund_total, 'debtOffset', v_debt_offset, 'cashRefund', v_cash_refund,
    'creditRefund', v_credit_refund, 'orderStatus', case when v_fully_returned then 'RETURNED' else v_order.status end
  );
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_SALES_RETURN', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_sales_return_secure(uuid, uuid, jsonb, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_sales_return_secure(uuid, uuid, jsonb, text, text, text, text, text) to service_role;

-- ============================================================
-- 6. Rút số dư trả lại khách
-- ============================================================

create or replace function public.withdraw_customer_credit_secure(
  p_actor_id uuid,
  p_customer_id uuid,
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
  v_customer public.customers%rowtype;
  v_amount numeric := greatest(0, coalesce(p_amount, 0));
  v_payment_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_cash_code text;
  v_response jsonb;
begin
  if p_actor_id is null or p_customer_id is null then
    raise exception 'Actor and customer are required' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'Withdraw amount must be positive' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if v_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':credit-withdraw:' || v_key));
  select response_json into v_cached from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'WITHDRAW_CUSTOMER_CREDIT' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'Customer was not found' using errcode = '22023';
  end if;
  if v_amount > coalesce(v_customer.credit_balance, 0) then
    raise exception 'Withdraw amount exceeds customer credit balance' using errcode = '22023';
  end if;

  update public.customers
  set credit_balance = coalesce(credit_balance, 0) - v_amount, updated_at = now()
  where id = p_customer_id;

  insert into public.customer_credit_ledger (customer_id, direction, amount, balance_after, source_type, note, created_by)
  values (p_customer_id, 'OUT', v_amount, coalesce(v_customer.credit_balance, 0) - v_amount, 'CREDIT_WITHDRAW',
    coalesce(nullif(btrim(p_note), ''), 'Rút số dư trả khách'), p_actor_id);

  v_cash_code := 'HT' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
  values (v_cash_code, case when v_payment_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'OUT', 'CREDIT_REFUND', p_customer_id,
    v_amount, v_payment_method, coalesce(nullif(btrim(p_note), ''), 'Rút số dư trả khách'), p_actor_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREDIT_WITHDRAW', 'customer', p_customer_id::text,
    jsonb_build_object('amount', v_amount, 'paymentMethod', v_payment_method, 'balanceAfter', coalesce(v_customer.credit_balance, 0) - v_amount));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'customerId', p_customer_id,
    'amount', v_amount, 'creditBalanceAfter', coalesce(v_customer.credit_balance, 0) - v_amount);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'WITHDRAW_CUSTOMER_CREDIT', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.withdraw_customer_credit_secure(uuid, uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.withdraw_customer_credit_secure(uuid, uuid, numeric, text, text, text) to service_role;
