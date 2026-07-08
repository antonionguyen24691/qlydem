create table if not exists public.inventory_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null default 'STOCK_COUNT',
  status text not null default 'PENDING',
  warehouse_id uuid references public.warehouses(id),
  requested_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  rejected_by uuid references public.users(id),
  rejected_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.inventory_adjustment_requests(id) on delete cascade,
  product_id uuid not null references public.products(id),
  old_quantity_box numeric not null default 0,
  new_quantity_box numeric not null default 0,
  quantity_change numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_edit_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  warehouse_id uuid references public.warehouses(id),
  old_quantity_box numeric not null default 0,
  new_quantity_box numeric not null default 0,
  quantity_change numeric not null default 0,
  source_type text not null,
  source_id uuid,
  edited_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_adjustment_requests_status_idx
  on public.inventory_adjustment_requests(status, created_at desc);

create index if not exists inventory_edit_logs_product_idx
  on public.inventory_edit_logs(product_id, created_at desc);
