-- PMQL — Đồng bộ tồn kho theo lô + nhập hàng sinh lô (G2).
-- Chiến lược: một trigger trên inventory_transactions tự phản chiếu mọi biến động
-- (nhập/xuất/kiểm kê/bán/trả) sang inventory_lot_balances. Nhờ vậy các RPC xuất/kiểm kê
-- KHÔNG phải viết lại phần tồn lô; chỉ các RPC nhập/bán cần set lot_id đúng lô.
--
-- Bất biến: sum(inventory_lot_balances của 1 kho×sp) = inventory_balances.quantity_box.
-- Trigger không raise khi thiếu tồn lô — dồn phần thiếu vào lô mặc định (cho phép âm)
-- để không chặn nghiệp vụ xuất đang chạy; số âm là tín hiệu cần rà soát.
--
-- ⚠️ Apply sau 20260721_lot_tracking.sql, trước khi deploy code dùng lô.

-- ============================================================
-- 1. Helper: tìm/tạo lô mặc định "TON-DAU-KY" cho 1 sản phẩm
-- ============================================================
create or replace function public.pmql_ensure_default_lot(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot_id uuid;
  v_cost numeric;
begin
  select id into v_lot_id
  from public.product_lots
  where product_id = p_product_id and lot_code = 'TON-DAU-KY'
  limit 1;
  if v_lot_id is not null then
    return v_lot_id;
  end if;

  select coalesce(cost_price, 0) into v_cost from public.products where id = p_product_id;
  insert into public.product_lots (product_id, lot_code, unit_cost, received_date, status, note)
  values (p_product_id, 'TON-DAU-KY', coalesce(v_cost, 0), now(), 'ACTIVE', 'Lô mặc định')
  on conflict (product_id, lot_code) do update set updated_at = now()
  returning id into v_lot_id;
  return v_lot_id;
end;
$$;

-- ============================================================
-- 2. Trigger đồng bộ tồn lô từ inventory_transactions
-- ============================================================
create or replace function public.pmql_sync_lot_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_qty numeric := coalesce(new.quantity_change, 0);
  v_lot uuid;
  v_after numeric;
  v_need numeric;
  v_take numeric;
  v_row record;
begin
  if v_qty = 0 or new.warehouse_id is null or new.product_id is null then
    return new;
  end if;

  -- (a) Đã chỉ định lô cụ thể (nhập lô mới / bán chọn lô / trả về đúng lô)
  if new.lot_id is not null then
    insert into public.inventory_lot_balances (warehouse_id, product_id, lot_id, quantity_box)
    values (new.warehouse_id, new.product_id, new.lot_id, v_qty)
    on conflict (warehouse_id, lot_id)
    do update set quantity_box = public.inventory_lot_balances.quantity_box + v_qty, updated_at = now()
    returning quantity_box into v_after;

    update public.product_lots
    set status = case when v_after <= 0 then 'SOLD_OUT' else 'ACTIVE' end, updated_at = now()
    where id = new.lot_id;
    return new;
  end if;

  -- (b) Nhập không chỉ định lô → dồn vào lô mặc định
  if v_qty > 0 then
    v_lot := public.pmql_ensure_default_lot(new.product_id);
    insert into public.inventory_lot_balances (warehouse_id, product_id, lot_id, quantity_box)
    values (new.warehouse_id, new.product_id, v_lot, v_qty)
    on conflict (warehouse_id, lot_id)
    do update set quantity_box = public.inventory_lot_balances.quantity_box + v_qty, updated_at = now();
    update public.product_lots set status = 'ACTIVE', updated_at = now() where id = v_lot;
    return new;
  end if;

  -- (c) Xuất không chỉ định lô → trừ FIFO theo lô cũ nhất còn tồn
  v_need := -v_qty;
  for v_row in
    select lb.lot_id, lb.quantity_box
    from public.inventory_lot_balances lb
    join public.product_lots l on l.id = lb.lot_id
    where lb.warehouse_id = new.warehouse_id
      and lb.product_id = new.product_id
      and lb.quantity_box > 0
    order by l.received_date asc, l.created_at asc
    for update
  loop
    exit when v_need <= 0;
    v_take := least(v_need, v_row.quantity_box);
    update public.inventory_lot_balances
    set quantity_box = quantity_box - v_take, updated_at = now()
    where warehouse_id = new.warehouse_id and lot_id = v_row.lot_id;
    update public.product_lots
    set status = case when (v_row.quantity_box - v_take) <= 0 then 'SOLD_OUT' else status end, updated_at = now()
    where id = v_row.lot_id;
    v_need := v_need - v_take;
  end loop;

  -- Thiếu tồn lô để trừ (do lệch dữ liệu) → dồn phần thiếu vào lô mặc định, cho phép âm.
  if v_need > 0 then
    v_lot := public.pmql_ensure_default_lot(new.product_id);
    insert into public.inventory_lot_balances (warehouse_id, product_id, lot_id, quantity_box)
    values (new.warehouse_id, new.product_id, v_lot, -v_need)
    on conflict (warehouse_id, lot_id)
    do update set quantity_box = public.inventory_lot_balances.quantity_box - v_need, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_transactions_sync_lot on public.inventory_transactions;
create trigger inventory_transactions_sync_lot
after insert on public.inventory_transactions
for each row execute function public.pmql_sync_lot_balance();

revoke all on function public.pmql_ensure_default_lot(uuid) from public, anon, authenticated;
revoke all on function public.pmql_sync_lot_balance() from public, anon, authenticated;
grant execute on function public.pmql_ensure_default_lot(uuid) to service_role;
grant execute on function public.pmql_sync_lot_balance() to service_role;

-- ============================================================
-- 3. Nhập kho 1 dòng: sinh lô + gắn lot_id vào phiếu/giao dịch
--    (phần tồn lô do trigger ở trên tự đồng bộ)
-- ============================================================
drop function if exists public.create_inventory_stock_in_secure(uuid, uuid, uuid, numeric, text, text, uuid, text, text, timestamptz, numeric, numeric, numeric, numeric, text);

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
  p_idempotency_key text,
  p_lot_code text default null,
  p_lot_id uuid default null,
  p_color_note text default null,
  p_quality_note text default null,
  p_image_urls jsonb default '[]'::jsonb
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
  v_lot_id uuid;
  v_lot_code text;
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

  -- Xác định lô đích: dùng lô có sẵn (p_lot_id) hoặc tạo lô mới
  if p_lot_id is not null then
    select id, lot_code into v_lot_id, v_lot_code from public.product_lots where id = p_lot_id and product_id = p_product_id;
    if v_lot_id is null then
      raise exception 'Lô không hợp lệ cho sản phẩm này' using errcode = '22023';
    end if;
  else
    v_lot_code := coalesce(
      nullif(btrim(p_lot_code), ''),
      'LOT-' || to_char(coalesce(p_received_at, now()), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
    );
    insert into public.product_lots (
      product_id, lot_code, supplier_id, purchase_id, received_date, unit_cost, color_note, quality_note, image_urls, status
    ) values (
      p_product_id, v_lot_code, p_supplier_id, v_purchase_id, coalesce(p_received_at, now()), v_unit_cost,
      nullif(btrim(p_color_note), ''), nullif(btrim(p_quality_note), ''), coalesce(p_image_urls, '[]'::jsonb), 'ACTIVE'
    ) returning id into v_lot_id;
  end if;

  if v_purchase_id is not null then
    insert into public.purchase_order_items (purchase_id, product_id, product_code, product_name, unit, quantity, unit_cost, line_total, lot_id)
    values (v_purchase_id, v_product.id, v_product.code, v_product.product_name, v_product.unit, v_quantity, v_unit_cost, v_line_total, v_lot_id);
  end if;

  if v_balance_exists then
    update public.inventory_balances
    set quantity_box = v_stock_after, updated_at = now()
    where warehouse_id = p_warehouse_id and product_id = p_product_id;
  else
    insert into public.inventory_balances (warehouse_id, product_id, quantity_box, quantity_piece)
    values (p_warehouse_id, p_product_id, v_stock_after, 0);
  end if;

  -- Trigger inventory_transactions_sync_lot sẽ cộng tồn vào đúng lô (v_lot_id).
  insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note, lot_id)
  values (p_warehouse_id, p_product_id, coalesce(nullif(btrim(p_operation_type), ''), 'PURCHASE_IN'), v_purchase_id, v_quantity, v_stock_after, nullif(btrim(p_transaction_note), ''), v_lot_id)
  returning * into v_transaction;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_json)
  values (p_actor_id, 'IN', 'inventory', v_transaction.id::text, to_jsonb(v_transaction));

  v_response := jsonb_build_object('ok', true, 'idempotent', false, 'transaction', to_jsonb(v_transaction), 'stockAfter', v_stock_after, 'purchaseId', v_purchase_id, 'lotId', v_lot_id, 'lotCode', v_lot_code);
  insert into public.idempotency_keys (actor_id, operation, request_key, response_json)
  values (p_actor_id, 'CREATE_INVENTORY_STOCK_IN', v_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.create_inventory_stock_in_secure(uuid, uuid, uuid, numeric, text, text, uuid, text, text, timestamptz, numeric, numeric, numeric, numeric, text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_inventory_stock_in_secure(uuid, uuid, uuid, numeric, text, text, uuid, text, text, timestamptz, numeric, numeric, numeric, numeric, text, text, uuid, text, text, jsonb) to service_role;

-- ============================================================
-- 4. Nhập kho nhiều dòng: mỗi dòng = 1 lô (đọc thêm lot_code/màu/chất lượng/ảnh trong p_items)
-- ============================================================
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
  v_lot_id uuid;
  v_lot_code text;
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

  -- Tổng tiền (cho phép cùng 1 sản phẩm nhiều dòng = nhiều lô khác nhau)
  for v_line in
    select line.product_id, line.quantity, line.unit_cost
    from jsonb_to_recordset(p_items) as line(product_id uuid, quantity numeric, unit_cost numeric)
  loop
    if v_line.product_id is null or coalesce(v_line.quantity, 0) <= 0 or coalesce(v_line.unit_cost, 0) < 0 then
      raise exception 'Receipt item is invalid' using errcode = '22023';
    end if;
    perform 1 from public.products where id = v_line.product_id and upper(coalesce(status, 'ACTIVE')) = 'ACTIVE';
    if not found then
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
    select line.product_id, line.quantity, line.unit_cost, line.lot_code, line.color_note, line.quality_note, line.image_urls
    from jsonb_to_recordset(p_items) as line(
      product_id uuid, quantity numeric, unit_cost numeric,
      lot_code text, color_note text, quality_note text, image_urls jsonb
    )
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

    -- Mỗi dòng nhập tạo 1 lô riêng
    v_lot_code := coalesce(
      nullif(btrim(v_line.lot_code), ''),
      'LOT-' || to_char(coalesce(p_received_at, now()), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
    );
    insert into public.product_lots (
      product_id, lot_code, supplier_id, purchase_id, received_date, unit_cost, color_note, quality_note, image_urls, status
    ) values (
      v_product.id, v_lot_code, v_supplier.id, v_purchase.id, coalesce(p_received_at, now()), v_line.unit_cost,
      nullif(btrim(v_line.color_note), ''), nullif(btrim(v_line.quality_note), ''), coalesce(v_line.image_urls, '[]'::jsonb), 'ACTIVE'
    ) returning id into v_lot_id;

    insert into public.purchase_order_items (purchase_id, product_id, product_code, product_name, unit, quantity, unit_cost, line_total, lot_id)
    values (v_purchase.id, v_product.id, v_product.code, v_product.product_name, v_product.unit, v_line.quantity, v_line.unit_cost, v_line.quantity * v_line.unit_cost, v_lot_id);

    -- Trigger đồng bộ tồn lô theo v_lot_id
    insert into public.inventory_transactions (warehouse_id, product_id, source_type, source_id, quantity_change, stock_after, note, lot_id)
    values (v_warehouse.id, v_product.id, 'PURCHASE_IN', v_purchase.id, v_line.quantity, v_stock_after, coalesce(nullif(btrim(p_note), ''), v_purchase.code), v_lot_id);

    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object('productId', v_product.id, 'quantity', v_line.quantity, 'unitCost', v_line.unit_cost, 'stockAfter', v_stock_after, 'lotId', v_lot_id, 'lotCode', v_lot_code));
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

revoke all on function public.create_inventory_receipt_secure(uuid, uuid, text, timestamptz, text, numeric, numeric, numeric, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_inventory_receipt_secure(uuid, uuid, text, timestamptz, text, numeric, numeric, numeric, text, text, jsonb, text) to service_role;
