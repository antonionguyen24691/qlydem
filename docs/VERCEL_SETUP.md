# Huong dan gan app vao Vercel

## 1. Chuan bi Supabase

1. Mo Supabase project: `https://excrmyipkxrcwpqgjcxp.supabase.co`.
2. Vao SQL Editor.
3. Chay toan bo file `supabase/schema.sql`.
4. Neu da tung chay schema cu, chay them cac file trong `supabase/migrations/` theo thu tu ten file.
5. Kiem tra bang `users` da co 2 admin:
   - `antonionguyen246@gmail.com`
   - `lanphuongngothi237@gmail.com`

## 2. Bat Google Login trong Supabase

1. Vao Authentication -> Providers.
2. Bat Google.
3. Tao Google OAuth Client trong Google Cloud Console.
4. Dien Client ID/Secret vao Supabase.
5. Trong Authentication -> URL Configuration:
   - Site URL: URL production Vercel sau khi deploy.
   - Redirect URLs:
     - `http://localhost:3000`
     - URL production Vercel.

## 3. Lay Supabase env

Can co:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Luu y: `SUPABASE_SERVICE_ROLE_KEY` phai la key co claim `role: service_role`. Key co claim `role: anon` khong du de API server ghi du lieu bang service role.

## 4. Gan repo vao Vercel

1. Vao Vercel Dashboard.
2. New Project.
3. Import GitHub repo `antonionguyen24691/qlydem`.
4. Framework Preset: Vite.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Them Environment Variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
APP_BASE_URL
```

Google Sheets env co the de trong neu chua dung sync Sheets ngay.

## 5. Deploy va kiem tra

1. Deploy production.
2. Mo URL Vercel.
3. Dang nhap bang Google:
   - `antonionguyen246@gmail.com`
   - hoac `Lanphuongngothi237@gmail.com`
4. Vao `Cau hinh`.
5. Kiem tra muc `Quan ly user va phan quyen`.
6. Thu them user sale:
   - Email Google cua sale.
   - Role: `SALE`.
   - Status: `ACTIVE`.
7. Tai file mau khach hang, nha cung cap, hang hoa.
8. Upload data.
9. Vao POS tao don thu.
10. Vao Tai chinh lap phieu thu.

## 6. Checklist hoan thanh

- [ ] SQL schema da chay thanh cong.
- [ ] 2 admin da co trong bang `users`.
- [ ] Google provider da bat.
- [ ] Vercel env da set.
- [ ] Production deploy thanh cong.
- [ ] Admin dang nhap duoc.
- [ ] Admin them/sua/khoa user duoc.
- [ ] Upload khach hang/NCC/hang hoa duoc.
- [ ] POS tao don ghi vao Supabase.
- [ ] Thu no tao receipt va allocation.
- [ ] Export XLSX hoat dong.
- [ ] Google Sheets sync hoat dong neu da cau hinh service account.
