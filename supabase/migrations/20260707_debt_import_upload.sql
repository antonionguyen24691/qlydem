alter table public.products
  add column if not exists product_type text not null default 'MERCHANDISE',
  add column if not exists parent_product_id uuid references public.products(id);

alter table public.customer_debt_ledger
  add column if not exists order_id uuid references public.sales_orders(id);

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

create index if not exists order_debts_customer_idx on public.order_debts(customer_id, status, due_date);
create index if not exists order_debts_assigned_idx on public.order_debts(assigned_to, status, due_date);
create index if not exists receipt_allocations_debt_idx on public.receipt_allocations(order_debt_id);
create index if not exists debt_reminders_schedule_idx on public.debt_reminders(status, scheduled_at);
create index if not exists payment_promises_customer_idx on public.payment_promises(customer_id, status, promised_date);
create index if not exists import_batches_entity_idx on public.import_batches(entity_type, created_at desc);
