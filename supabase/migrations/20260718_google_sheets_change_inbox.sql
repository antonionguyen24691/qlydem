-- Google Sheets is a reporting mirror. Reverse sync is deliberately limited to
-- approved master-data edits staged in sheet_change_requests, never financial
-- or stock transactions.
create table if not exists public.sheet_change_requests (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'GOOGLE_SHEETS',
  entity_type text not null check (entity_type in ('customers', 'suppliers', 'products')),
  target_code text not null,
  target_id uuid not null,
  field_name text not null,
  proposed_value jsonb not null,
  expected_updated_at timestamptz,
  note text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'STALE', 'FAILED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  applied_at timestamptz,
  error_message text
);

create index if not exists sheet_change_requests_status_submitted_idx
  on public.sheet_change_requests(status, submitted_at desc);
create unique index if not exists sheet_change_requests_pending_dedupe_idx
  on public.sheet_change_requests(entity_type, target_id, field_name)
  where status = 'PENDING';

alter table public.sheet_change_requests enable row level security;
revoke all on table public.sheet_change_requests from anon, authenticated;
