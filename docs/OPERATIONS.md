# CRM QLBH Operations

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
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Luu y: `SUPABASE_SERVICE_ROLE_KEY` chi dung o API server, khong duoc dua vao frontend.

## 2. Google Sheets

1. Tao Google Cloud service account.
2. Bat Google Sheets API.
3. Tao Google Sheets file moi lam reporting mirror.
4. Share sheet cho email service account voi quyen Editor.
5. Set env:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Private key can giu dang mot dong voi `\n`, giong `.env.example`.

## 3. Vercel

1. Link project:

```powershell
npx --yes vercel link
```

2. Them env tren Vercel dashboard hoac CLI:

```powershell
npx --yes vercel env add SUPABASE_URL production
npx --yes vercel env add SUPABASE_ANON_KEY production
npx --yes vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx --yes vercel env add GOOGLE_SHEETS_SPREADSHEET_ID production
npx --yes vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL production
npx --yes vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production
npx --yes vercel env add INTERNAL_API_SECRET production
```

3. Deploy:

```powershell
npm run deploy:vercel
```

## 4. API da co

Health:

```http
GET /api/health
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
x-internal-secret: <INTERNAL_API_SECRET>
Content-Type: application/json
```

API nay ghi `sales_orders`, `sales_order_items`, `order_debts`, `customer_debt_ledger`, `receipt_allocations`, `cashbook_entries`, `inventory_transactions`, `audit_logs` va cap nhat `customers.current_debt`. Neu co kho mac dinh, API dong thoi cap nhat `inventory_balances`.

Lap phieu thu/phan bo tra no:

```http
POST /api/receipts/create
x-internal-secret: <INTERNAL_API_SECRET>
Content-Type: application/json
```

Neu khong truyen allocations, API tu phan bo vao cac don no dang mo cu nhat cua khach.

Dong bo Supabase ve Google Sheets:

```http
POST /api/sync/google-sheets?tables=customers,products,sales_orders
x-internal-secret: <INTERNAL_API_SECRET>
```

Neu bo `tables`, API se sync toan bo cac bang duoc cho phep.

Xuat XLSX:

```http
GET /api/export/xlsx?tables=customers,products,customer_debt_ledger
x-internal-secret: <INTERNAL_API_SECRET>
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
x-internal-secret: <INTERNAL_API_SECRET>
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
4. Import du lieu tu `NHAT KY BAN HANG.xlsx` vao Supabase.
5. Frontend da doc `/api/data/*`; sau khi deploy can upload data that truoc khi van hanh.
6. Viet API tao don ban co transaction: order, items, ton kho, ledger cong no.
7. Them login/RBAC.
8. Them in bill va Customer 360.
