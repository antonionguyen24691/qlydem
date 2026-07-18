# PMQL Operations

Tai lieu nay bien app demo thanh nen van hanh co the deploy:

- Frontend: Vite/React deploy tren Vercel.
- API: Vercel Serverless Functions trong thu muc `api/`.
- Database chinh: Supabase Postgres.
- Reporting/doi soat: dong bo Supabase ve Google Sheets.
- Export: tai file `.xlsx` tu API.

## 1. Supabase

1. Tao project Supabase.
2. Mo SQL Editor va chay file `supabase/schema.sql`.
3. Copy `Project URL`, `anon key`, `service_role key`.
4. Dua vao `.env.local` khi chay local va Vercel Environment Variables khi deploy.

Env bat buoc:

- `SUPABASE_URL`
- `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Luu y: `SUPABASE_SERVICE_ROLE_KEY` chi dung o API server, khong duoc dua vao frontend.
Key service role phai co claim `role: service_role`. Neu key dang co claim `role: anon`, hay lay lai trong Supabase Project Settings -> API.

## 1.1 Google Login

Trong Supabase Dashboard:

1. Vao Authentication -> Providers.
2. Bat Google provider.
3. Dien Google OAuth Client ID/Secret.
4. Them Site URL va Redirect URLs:
   - Local: `http://localhost:3000`
   - Production: URL Vercel cua app.

API khong tu cap quyen ADMIN cho user dau tien. Dung `npm run bootstrap:admins` de provision admin theo danh sach email/env duoc phep, sau do admin tao cac user con lai voi role phu hop.
Schema cung seed san 2 admin:

- `antonionguyen246@gmail.com`
- `lanphuongngothi237@gmail.com`

Admin co the vao `Cau hinh` de them, sua, khoa user, gan role va dat mat khau dang nhap email/password.

## 2. Google Sheets

1. Tao Google Cloud service account.
2. Bat Google Sheets API.
3. Co the tao Google Sheets file moi bang script `npm run sheets:create`.
4. Neu da co sheet san, share sheet cho email service account voi quyen Editor.
5. Set env:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - `GOOGLE_SHARE_EMAIL` neu muon script tao sheet tu dong share cho admin.
   - `GOOGLE_SHEETS_SYNC_SECRET` neu dung hang cho dong bo nguoc Apps Script.

Private key can giu dang mot dong voi `\n`, giong `.env.example`.

Tao file Google Sheets backup tu service account:

```powershell
$env:GOOGLE_SHARE_EMAIL="admin@example.com"
npm run sheets:create
```

Lenh tren tra ve `spreadsheetId`. Dua ID nay vao `GOOGLE_SHEETS_SPREADSHEET_ID` tren `.env.local` va Vercel.

Neu muon tao bang cach thu cong trong Google Sheets/Apps Script, dung MasterScript:

1. Mo Google Sheets bat ky, vao `Extensions -> Apps Script`.
2. Copy noi dung file `scripts/google-apps-script/PMQL_MasterScript.gs` vao `Code.gs`.
3. Chay `PMQL_createBackupSpreadsheet()` de tao file backup moi, hoac `PMQL_setupCurrentSpreadsheet()` de tao tab tren file dang mo.
4. Copy Spreadsheet ID cua file vua tao dua vao `GOOGLE_SHEETS_SPREADSHEET_ID`.

MasterScript se tao cac tab mirror, `backup_log`, `dashboard`, va `PMQL_change_inbox`. Script hien da tao du cac tab export hien co cua app, ke ca bang duyet/audit.

### Dong bo nguoc co duyet

Google Sheet khong duoc ghi thang vao du lieu giao dich. De gui cap nhat danh muc nguoc ve app:

1. Trong Apps Script, vao **Project Settings -> Script properties**, dat `PMQL_API_BASE_URL` va `PMQL_SYNC_SECRET`. Secret phai trung voi `GOOGLE_SHEETS_SYNC_SECRET` tren Vercel.
2. Chay lai `PMQL_setupCurrentSpreadsheet()` mot lan de tao tab `PMQL_change_inbox`.
3. Them dong voi `action = SEND`, `entity` la `customers`, `suppliers` hoac `products`, kem `code`, `field`, `value`, `expected_updated_at`, `note`.
4. Chon menu **PMQL -> Submit change inbox to PMQL**.
5. Admin vao **Cau hinh -> Du lieu & backup**, tai hang cho va chon **Ap dung** hoac **Tu choi**.

Backend chi cho phep sua truong danh muc an toan va kiem tra `updated_at` lai truoc khi ap dung. Don ban/mua, phieu thu-chi, cong no, gia von/gia ban va ton kho bi cam dong bo nguoc de tranh lech so lieu.

Dong bo Supabase -> Google Sheets bang script local:

```powershell
npm run sheets:sync
npm run sheets:sync -- customers,products,inventory_balances
```

Khi app da cau hinh Google env, he thong co 2 co che backup Google Sheets:

- Cuoi ngay: Vercel Cron goi `GET /api/sync/google-sheets` luc 23:55 gio Viet Nam.
- Khi phat sinh giao dich: API tao don ban va lap phieu thu se best-effort sync cac bang lien quan sang Google Sheets. Neu Google Sheets chua cau hinh, giao dich van thanh cong va bo qua sync.

## 3. Vercel

1. Link project:

```powershell
npx --yes vercel link
```

2. Them env tren Vercel dashboard hoac CLI:

```powershell
npx --yes vercel env add SUPABASE_URL production
npx --yes vercel env add VITE_SUPABASE_URL production
npx --yes vercel env add SUPABASE_ANON_KEY production
npx --yes vercel env add VITE_SUPABASE_ANON_KEY production
npx --yes vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx --yes vercel env add GOOGLE_SHEETS_SPREADSHEET_ID production
npx --yes vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL production
npx --yes vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production
npx --yes vercel env add GOOGLE_SHEETS_SYNC_SECRET production
npx --yes vercel env add CRON_SECRET production
```

3. Deploy:

```powershell
npm run deploy:vercel
```

Sau khi deploy, kiem tra monitoring cong khai (khong can token):

```http
GET /api/health
```

Ket qua `status: "ready"` xac nhan API doc duoc Supabase. `googleSheetsBackup` va
`scheduledGoogleSheetsBackup` phai la `configured` truoc khi xem backup Google Sheets
la da san sang. Endpoint khong tra ve secret, ten bang hay du lieu kinh doanh.

## 4. API da co

Kiem tra API cong khai:

```http
GET /api/settings?key=branding
```

Sau khi apply migration Update 2.0, user da dang nhap co the doc license va feature hien tai:

```http
GET /api/settings?key=entitlements
Authorization: Bearer <supabase_access_token>
```

Doc mot bang Supabase:

```http
GET /api/data/customers
GET /api/data/products
GET /api/data/sales_orders
```

Tao don ban that:

```http
POST /api/orders/create
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

API nay ghi `sales_orders`, `sales_order_items`, `order_debts`, `customer_debt_ledger`, `receipt_allocations`, `cashbook_entries`, `inventory_transactions`, `audit_logs` va cap nhat `customers.current_debt`. Neu co kho mac dinh, API dong thoi cap nhat `inventory_balances`.

Lap phieu thu/phan bo tra no:

```http
POST /api/receipts/create
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

Neu khong truyen allocations, API tu phan bo vao cac don no dang mo cu nhat cua khach.

Dong bo Supabase ve Google Sheets:

```http
POST /api/sync/google-sheets?tables=customers,products,sales_orders
Authorization: Bearer <supabase_access_token>
```

Neu bo `tables`, API se sync toan bo cac bang duoc cho phep.

Vercel Cron goi endpoint nay bang:

```http
GET /api/sync/google-sheets
Authorization: Bearer <CRON_SECRET>
```

Xuat XLSX:

```http
GET /api/export/xlsx?tables=customers,products,customer_debt_ledger
Authorization: Bearer <supabase_access_token>
```

Tai file mau upload:

```http
GET /api/templates/customers
GET /api/templates/suppliers
GET /api/templates/products
```

Upload file `.xlsx`:

```http
POST /api/import/customers
POST /api/import/suppliers
POST /api/import/products
Authorization: Bearer <supabase_access_token>
x-file-name: customers.xlsx
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Body la binary cua file `.xlsx`. Ket qua import duoc ghi vao:

- `import_batches`
- `import_errors`

File mau `products` co cot `Loai hang`, nhan cac gia tri de xuat:

- `RAW_MATERIAL`: nguyen lieu.
- `SEMI_FINISHED`: ban thanh pham.
- `FINISHED`: thanh pham.
- `MERCHANDISE`: hang hoa mua ban.

File mau `products` cung co:

- `Ma kho`: neu kho chua co, he thong tu tao kho.
- `Ton dau ky`: tao/cap nhat ton dau ky trong `inventory_balances`.
- `Muc ton toi thieu`: dung cho canh bao ton kho.

Import truc tiep sheet `KHO HANG` tu workbook goc:

```powershell
npm run import:kho-hang
```

Lenh nay doc `NHAT KY BAN HANG.xlsx`, sheet `KHO HANG`, upsert vao `products` va tao/cap nhat ton kho `KHO-CHINH` trong `inventory_balances`. Neu sheet co ma hang trung, script dedupe theo `Mã hàng`.

## 4.1 He thong cong no theo tung don

Schema hien co them cac bang:

- `order_debts`: cong no rieng cho tung don ban.
- `receipt_allocations`: mot phieu thu co the chia tra cho nhieu don; mot don co the duoc tra nhieu lan.
- `debt_assignments`: giao khoan no cho tung sale/ke toan/nhan su phu trach.
- `debt_reminders`: lich nhac no theo don/khach/nguoi phu trach.
- `debt_reminder_logs`: lich su da nhac, kenh nhac, phan hoi.
- `payment_promises`: cam ket/hua tra no cua khach.
- `customer_contacts`: nguoi lien he/thanh toan ben khach.

## 5. Git workflow de xuat

Branch:

- `main`: production.
- `dev`: staging/local integration.
- `feature/*`: tung tinh nang.

Quy trinh:

```powershell
git status
git add .
git commit -m "chore: bootstrap crm operations"
git push origin main
```

Vercel nen noi voi GitHub repo de moi push len `main` tu deploy production.

## 6. Viec con lai de app dung that

Nen lam tiep theo thu tu nay:

1. Tao Supabase project va chay schema.
2. Tao Google Sheets mirror va service account.
3. Set env local + Vercel.
4. Import du lieu tu `NHAT KY BAN HANG.xlsx` vao Supabase bang `npm run import:kho-hang` hoac man hinh upload.
5. Tao Google Sheets mirror, set env Google, chay `npm run sheets:sync` lan dau.
6. Kiem tra Vercel Cron va sync sau giao dich.
7. Hoan thien tiep in bill, Customer 360 va canh bao cong no nang cao.
