-- PMQL — Quản lý lô hàng (số lô) theo mã hàng.
-- Nền dữ liệu: tách tồn kho theo (kho × sản phẩm × lô) để phân biệt chất lượng/màu/ảnh
-- giữa các lần nhập cùng mã. Giữ inventory_balances cũ làm tổng (rollup) để không vỡ
-- các màn hình/report hiện có.
--
-- ⚠️ Apply migration này TRƯỚC khi deploy code API/RPC dùng lô (G2–G6).

-- ============================================================
-- 1. Bảng lô hàng
-- ============================================================
create table if not exists public.product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id),
  lot_code      text not null,
  supplier_id   uuid references public.suppliers(id),
  purchase_id   uuid references public.purchase_orders(id),
  received_date timestamptz not null default now(),
  unit_cost     numeric not null default 0,
  color_note    text,
  quality_note  text,
  image_urls    jsonb not null default '[]'::jsonb,
  status        text not null default 'ACTIVE',
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, lot_code)
);

create index if not exists product_lots_product_idx on public.product_lots(product_id, status, received_date);
create index if not exists product_lots_supplier_idx on public.product_lots(supplier_id, received_date desc);

-- ============================================================
-- 2. Tồn kho chi tiết theo lô (inventory_balances cũ = tổng các lô)
-- ============================================================
create table if not exists public.inventory_lot_balances (
  id uuid primary key default gen_random_uuid(),
  warehouse_id   uuid not null references public.warehouses(id),
  product_id     uuid not null references public.products(id),
  lot_id         uuid not null references public.product_lots(id),
  quantity_box   numeric not null default 0,
  quantity_piece numeric not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (warehouse_id, lot_id)
);

create index if not exists inventory_lot_balances_wh_product_idx
  on public.inventory_lot_balances(warehouse_id, product_id);
create index if not exists inventory_lot_balances_lot_idx
  on public.inventory_lot_balances(lot_id);

-- ============================================================
-- 3. Cột lô ở các bảng giao dịch (nullable → dữ liệu cũ hợp lệ)
-- ============================================================
alter table public.purchase_order_items  add column if not exists lot_id uuid references public.product_lots(id);
alter table public.sales_order_items      add column if not exists lot_id uuid references public.product_lots(id);
alter table public.sales_order_items      add column if not exists lot_code text;
alter table public.inventory_transactions add column if not exists lot_id uuid references public.product_lots(id);
alter table public.sales_return_items     add column if not exists lot_id uuid references public.product_lots(id);

create index if not exists sales_order_items_lot_idx on public.sales_order_items(lot_id);

-- ============================================================
-- 4. Cờ bật lô theo sản phẩm + phương pháp giá vốn
-- ============================================================
alter table public.products add column if not exists track_lots boolean not null default false;

-- costing_method: 'LOT' (đích danh theo lô) | 'AVERAGE' (bình quân như cũ). Mặc định LOT.
insert into public.settings (key, value)
values ('costing_method', '{"method": "LOT"}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- 5. Migrate tồn hiện có → lô "tồn đầu kỳ"
-- ============================================================
insert into public.product_lots (product_id, lot_code, unit_cost, received_date, status, note)
select p.id, 'TON-DAU-KY', coalesce(p.cost_price, 0), now(), 'ACTIVE', 'Lô tồn đầu kỳ khi bật quản lý lô'
from public.products p
where exists (
  select 1 from public.inventory_balances b
  where b.product_id = p.id and coalesce(b.quantity_box, 0) > 0
)
and not exists (
  select 1 from public.product_lots l
  where l.product_id = p.id and l.lot_code = 'TON-DAU-KY'
);

insert into public.inventory_lot_balances (warehouse_id, product_id, lot_id, quantity_box, quantity_piece)
select b.warehouse_id, b.product_id, l.id, b.quantity_box, coalesce(b.quantity_piece, 0)
from public.inventory_balances b
join public.product_lots l
  on l.product_id = b.product_id and l.lot_code = 'TON-DAU-KY'
where coalesce(b.quantity_box, 0) > 0
on conflict (warehouse_id, lot_id) do nothing;

-- ============================================================
-- 6. RLS: khóa anon/authenticated, chỉ service_role (như các bảng khác)
-- ============================================================
do $$
declare
  v_table text;
begin
  foreach v_table in array array['product_lots', 'inventory_lot_balances']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;
