create table if not exists public.price_update_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null default 'SALE_PRICE_UPDATE',
  status text not null default 'PENDING',
  requested_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  rejected_by uuid references public.users(id),
  rejected_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_update_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.price_update_requests(id) on delete cascade,
  product_id uuid not null references public.products(id),
  old_sell_price numeric not null default 0,
  new_sell_price numeric not null default 0,
  old_cost_price numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.price_edit_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  old_sell_price numeric not null default 0,
  new_sell_price numeric not null default 0,
  old_cost_price numeric not null default 0,
  source_type text not null,
  source_id uuid,
  edited_by uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists price_update_requests_status_idx
  on public.price_update_requests(status, created_at desc);

create index if not exists price_update_request_items_request_idx
  on public.price_update_request_items(request_id);

create index if not exists price_edit_logs_product_idx
  on public.price_edit_logs(product_id, created_at desc);
