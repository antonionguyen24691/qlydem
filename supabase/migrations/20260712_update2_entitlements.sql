-- Update 2.0 foundation: tenant identity, lifetime licenses, feature overrides and usage counters.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists tenant_id uuid references public.tenants(id);

insert into public.tenants (code, name)
values ('default', 'PMQL')
on conflict (code) do nothing;

update public.users
set tenant_id = (select id from public.tenants where code = 'default')
where tenant_id is null;

create index if not exists users_tenant_status_idx on public.users(tenant_id, status);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  plan_code text not null check (plan_code in ('BASIC', 'SMART', 'LOCAL', 'CLOUD', 'MOBILE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  is_lifetime boolean not null default true,
  activated_at timestamptz not null default now(),
  warranty_until timestamptz,
  maintenance_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists licenses_one_active_per_tenant_idx
  on public.licenses(tenant_id)
  where status = 'ACTIVE';

create index if not exists licenses_tenant_status_idx
  on public.licenses(tenant_id, status, activated_at desc);

insert into public.licenses (tenant_id, plan_code, metadata)
select id, 'CLOUD', jsonb_build_object('source', 'legacy_update2_bootstrap')
from public.tenants
where code = 'default'
  and not exists (
    select 1 from public.licenses
    where licenses.tenant_id = tenants.id and licenses.status = 'ACTIVE'
  );

create table if not exists public.license_entitlements (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value bigint check (limit_value is null or limit_value >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_id, feature_key)
);

create index if not exists license_entitlements_license_idx
  on public.license_entitlements(license_id, feature_key);

create table if not exists public.license_installations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  installation_key text not null,
  device_name text,
  platform text,
  app_version text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (license_id, installation_key)
);

create index if not exists license_installations_license_status_idx
  on public.license_installations(license_id, status, last_seen_at desc);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  license_id uuid not null references public.licenses(id) on delete cascade,
  usage_key text not null,
  period_start date not null,
  period_end date not null,
  used_count bigint not null default 0 check (used_count >= 0),
  reserved_count bigint not null default 0 check (reserved_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (tenant_id, usage_key, period_start, period_end)
);

create index if not exists usage_counters_tenant_period_idx
  on public.usage_counters(tenant_id, usage_key, period_end desc);

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'tenants', 'licenses', 'license_entitlements', 'license_installations', 'usage_counters'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;
