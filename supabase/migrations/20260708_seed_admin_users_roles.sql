insert into public.roles (role, name, permissions_json)
values
  ('ADMIN', 'Quản trị viên', '{"all": true}'::jsonb),
  ('ACCOUNTANT', 'Kế toán', '{"orders": ["read"], "customers": ["read"], "finance": ["read", "create", "update"], "reports": ["read"], "export": ["read"]}'::jsonb),
  ('SALE', 'Nhân viên bán hàng', '{"orders": ["read", "create"], "customers": ["read", "create"], "products": ["read"], "finance": ["read_own"]}'::jsonb),
  ('WAREHOUSE', 'Kho', '{"products": ["read"], "inventory": ["read", "create", "update"], "purchase": ["read", "create"]}'::jsonb),
  ('VIEWER', 'Chỉ xem', '{"dashboard": ["read"], "reports": ["read"]}'::jsonb)
on conflict (role) do update
set name = excluded.name,
    permissions_json = excluded.permissions_json,
    updated_at = now();

insert into public.users (email, full_name, role, status)
values
  ('antonionguyen246@gmail.com', 'Antonio Nguyen', 'ADMIN', 'ACTIVE'),
  ('lanphuongngothi237@gmail.com', 'Lan Phuong Ngo Thi', 'ADMIN', 'ACTIVE')
on conflict (email) do update
set role = 'ADMIN',
    status = 'ACTIVE',
    full_name = excluded.full_name,
    updated_at = now();

insert into public.settings (key, value)
values (
  'branding',
  '{
    "appName": "PMQL",
    "companyName": "PMQL",
    "appDescription": "Phần mềm quản lý bán hàng",
    "address": "",
    "hotline": "",
    "taxCode": "",
    "logoUrl": "",
    "faviconUrl": ""
  }'::jsonb
)
on conflict (key) do update
set value = excluded.value || public.settings.value,
    updated_at = now();
