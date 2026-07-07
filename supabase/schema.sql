create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  phone text,
  role text not null default 'SALE',
  status text not null default 'ACTIVE',
  sale_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  role text primary key,
  name text not null,
  permissions_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  short_name text,
  phone text,
  address text,
  tax_code text,
  customer_group text default 'RETAIL',
  assigned_sale_id uuid references public.users(id),
  credit_limit numeric not null default 0,
  credit_days integer not null default 0,
  status text not null default 'ACTIVE',
  note text,
  last_order_at timestamptz,
  total_revenue numeric not null default 0,
  current_debt numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  short_name text,
  phone text,
  address text,
  tax_code text,
  contact_person text,
  payment_terms text,
  status text not null default 'ACTIVE',
  note text,
  current_payable numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  invoice_name text,
  product_name text not null,
  product_type text not null default 'MERCHANDISE',
  parent_product_id uuid references public.products(id),
  category text,
  brand text,
  size text,
  unit text not null default 'HOP',
  m2_per_box numeric,
  pieces_per_box numeric,
  price_by_m2 numeric,
  sell_price_box_vat numeric,
  cost_price numeric not null default 0,
  vat_rate numeric not null default 0,
  barcode text,
  status text not null default 'ACTIVE',
  lifecycle_status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_status_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.users(id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  address text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  quantity_box numeric not null default 0,
  quantity_piece numeric not null default 0,
  min_stock_level numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id)
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  order_date timestamptz not null default now(),
  customer_id uuid references public.customers(id),
  sale_id uuid references public.users(id),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  debt_amount numeric not null default 0,
  payment_method text not null default 'CASH',
  status text not null default 'COMPLETED',
  note text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_code text,
  product_name text not null,
  unit text,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_rate numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  purchase_date timestamptz not null default now(),
  supplier_id uuid references public.suppliers(id),
  warehouse_id uuid references public.warehouses(id),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  payable_amount numeric not null default 0,
  status text not null default 'RECEIVED',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_code text,
  product_name text not null,
  unit text,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.sales_orders(id),
  amount numeric not null,
  payment_method text not null default 'CASH',
  receipt_date timestamptz not null default now(),
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  supplier_id uuid not null references public.suppliers(id),
  purchase_id uuid references public.purchase_orders(id),
  amount numeric not null,
  payment_method text not null default 'CASH',
  payment_date timestamptz not null default now(),
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_debt_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.sales_orders(id),
  source_type text not null,
  source_id uuid,
  debit numeric not null default 0,
  credit numeric not null default 0,
  balance_after numeric not null default 0,
  due_date date,
  status text not null default 'OPEN',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_debts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.sales_orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  sale_id uuid references public.users(id),
  original_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  due_date date,
  status text not null default 'OPEN',
  assigned_to uuid references public.users(id),
  last_reminded_at timestamptz,
  next_reminder_at timestamptz,
  closed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  order_debt_id uuid not null references public.order_debts(id) on delete cascade,
  order_id uuid not null references public.sales_orders(id),
  customer_id uuid not null references public.customers(id),
  amount numeric not null,
  allocated_at timestamptz not null default now(),
  allocated_by uuid references public.users(id),
  note text,
  created_at timestamptz not null default now(),
  unique (receipt_id, order_debt_id)
);

create table if not exists public.debt_assignments (
  id uuid primary key default gen_random_uuid(),
  order_debt_id uuid not null references public.order_debts(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  assigned_to uuid not null references public.users(id),
  assigned_by uuid references public.users(id),
  role text not null default 'COLLECTOR',
  status text not null default 'ACTIVE',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.debt_reminders (
  id uuid primary key default gen_random_uuid(),
  order_debt_id uuid references public.order_debts(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  assigned_to uuid references public.users(id),
  reminder_type text not null default 'DEBT_DUE',
  channel text not null default 'APP',
  scheduled_at timestamptz not null,
  status text not null default 'PENDING',
  title text,
  message text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.debt_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.debt_reminders(id) on delete set null,
  order_debt_id uuid references public.order_debts(id) on delete set null,
  customer_id uuid not null references public.customers(id),
  actor_id uuid references public.users(id),
  channel text not null,
  action text not null,
  message text,
  response text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  order_debt_id uuid references public.order_debts(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  promised_amount numeric not null,
  promised_date date not null,
  status text not null default 'OPEN',
  contact_name text,
  contact_phone text,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  position text,
  is_billing_contact boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_debt_ledger (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  source_type text not null,
  source_id uuid,
  debit numeric not null default 0,
  credit numeric not null default 0,
  balance_after numeric not null default 0,
  due_date date,
  status text not null default 'OPEN',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references public.warehouses(id),
  product_id uuid not null references public.products(id),
  source_type text not null,
  source_id uuid,
  quantity_change numeric not null default 0,
  stock_after numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  account_type text not null default 'CASH',
  direction text not null,
  source_type text not null,
  source_id uuid,
  amount numeric not null default 0,
  payment_method text not null default 'CASH',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  file_name text,
  status text not null default 'PROCESSING',
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  note text
);

create table if not exists public.import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  entity_type text not null,
  row_json jsonb,
  error_message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists customers_code_idx on public.customers(code);
create index if not exists customers_name_idx on public.customers using gin (to_tsvector('simple', coalesce(name, '')));
create index if not exists products_code_idx on public.products(code);
create index if not exists sales_orders_order_date_idx on public.sales_orders(order_date desc);
create index if not exists customer_debt_customer_idx on public.customer_debt_ledger(customer_id, created_at desc);
create index if not exists supplier_debt_supplier_idx on public.supplier_debt_ledger(supplier_id, created_at desc);
create index if not exists order_debts_customer_idx on public.order_debts(customer_id, status, due_date);
create index if not exists order_debts_assigned_idx on public.order_debts(assigned_to, status, due_date);
create index if not exists receipt_allocations_debt_idx on public.receipt_allocations(order_debt_id);
create index if not exists debt_reminders_schedule_idx on public.debt_reminders(status, scheduled_at);
create index if not exists payment_promises_customer_idx on public.payment_promises(customer_id, status, promised_date);
create index if not exists import_batches_entity_idx on public.import_batches(entity_type, created_at desc);
