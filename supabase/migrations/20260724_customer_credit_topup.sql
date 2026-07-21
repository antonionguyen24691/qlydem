-- PMQL — Giữ tiền thừa vào số dư khách hàng (overpay -> store credit).
-- Khi khách CÓ TÊN trả dư tiền và chọn "giữ tiền thừa", API gọi RPC này SAU khi tạo đơn:
--   + cộng tiền thừa vào customers.credit_balance
--   + ghi customer_credit_ledger (IN)
--   + ghi cashbook_entries (IN) — phần tiền mặt/CK thực nhận thêm
-- Nếu không chọn giữ -> hoàn tiền thừa cho khách (không ghi nhận, như cũ).
--
-- ⚠️ Apply sau các migration lô. Không đổi hàm bán hàng, chỉ thêm 1 hàm độc lập.

create or replace function public.topup_customer_credit_secure(
  p_actor_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_source_order_id uuid,
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
  v_order public.sales_orders%rowtype;
  v_amount numeric := round(greatest(0, coalesce(p_amount, 0)));
  v_method text := upper(coalesce(nullif(btrim(p_payment_method), ''), 'CASH'));
  v_balance_after numeric;
  v_cash_code text;
  v_note text;
  v_response jsonb;
begin
  if p_actor_id is null or p_customer_id is null then
    raise exception 'Actor and customer are required' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if v_method not in ('CASH', 'TRANSFER') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_id::text || ':credit-topup:' || v_key));
  select response_json into v_cached
  from public.idempotency_keys
  where actor_id = p_actor_id and operation = 'TOPUP_CUSTOMER_CREDIT' and request_key = v_key;
  if found then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found or upper(coalesce(v_customer.status, 'ACTIVE')) <> 'ACTIVE' then
    raise exception 'Customer is not active' using errcode = '22023';
  end if;

  if p_source_order_id is not null then
    select * into v_order from public.sales_orders where id = p_source_order_id;
  end if;
  v_note := coalesce(
    nullif(btrim(p_note), ''),
    'Tiền thừa giữ lại' || case when v_order.code is not null then ' đơn ' || v_order.code else '' end
  );

  v_balance_after := coalesce(v_customer.credit_balance, 0) + v_amount;
  update public.customers set credit_balance = v_balance_after, updated_at = now() where id = p_customer_id;

  -- source_type PHẢI thuộc CHECK của customer_credit_ledger:
  -- ('OVERPAYMENT', 'RETURN_REFUND', 'ORDER_PAYMENT', 'CREDIT_WITHDRAW', 'ADJUST')
  insert into public.customer_credit_ledger (customer_id, direction, amount, balance_after, source_type, source_id, note, created_by)
  values (p_customer_id, 'IN', v_amount, v_balance_after, 'OVERPAYMENT', p_source_order_id, v_note, p_actor_id);

  v_cash_code := 'TM' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cashbook_entries (code, account_type, direction, source_type, source_id, amount, payment_method, note, created_by)
  values (v_cash_code, case when v_method = 'TRANSFER' then 'BANK' else 'CASH' end, 'IN', 'CUSTOMER_CREDIT', coalesce(p_source_order_id, p_customer_id), v_amount, v_method, v_note, p_actor_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'CREDIT_TOPUP', 'customer', p_customer_id::text,
    jsonb_build_object('amount', v_amount, 'balanceAfter', v_balance_after, 'orderId', p_source_order_id));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'creditBalance', v_balance_after, 'amount', v_amount);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'TOPUP_CUSTOMER_CREDIT', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.topup_customer_credit_secure(uuid, uuid, numeric, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.topup_customer_credit_secure(uuid, uuid, numeric, text, uuid, text, text) to service_role;
