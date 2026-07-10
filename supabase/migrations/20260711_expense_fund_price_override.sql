-- Chi phí vận hành, chuyển/rút quỹ và cho phép sửa giá bán/ĐVT khi tạo đơn.
-- Apply after 20260710_finance_inventory_controls.sql.

alter table public.cashbook_entries
  add column if not exists category text,
  add column if not exists person text,
  add column if not exists entry_date date not null default current_date;

create index if not exists cashbook_entries_source_type_idx on public.cashbook_entries(source_type, created_at desc);
create index if not exists cashbook_entries_entry_date_idx on public.cashbook_entries(entry_date desc);

-- Recreate the sales order RPC with optional per-line price/unit override.
drop function if exists public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text);

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
  p_allow_price_override boolean default false
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
  values (p_actor_id, 'CREATE', 'sales_order', v_order.id::text, jsonb_build_object('order', to_jsonb(v_order), 'items', v_item_rows, 'priceOverride', p_allow_price_override));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'order', to_jsonb(v_order), 'items', v_item_rows, 'debt', to_jsonb(v_debt), 'receipt', to_jsonb(v_receipt));
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_SALES_ORDER', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_sales_order_secure(uuid, uuid, uuid, jsonb, text, numeric, numeric, date, text, text, boolean) to service_role;
