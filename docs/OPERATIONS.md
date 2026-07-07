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

1. Cai Vercel CLI neu chua co:

```powershell
npm i -g vercel
```

2. Link project:

```powershell
vercel link
```

3. Them env tren Vercel dashboard hoac CLI:

```powershell
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GOOGLE_SHEETS_SPREADSHEET_ID production
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL production
vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production
vercel env add INTERNAL_API_SECRET production
```

4. Deploy:

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
5. Chuyen frontend doc `/api/data/*` thay cho mock.
6. Viet API tao don ban co transaction: order, items, ton kho, ledger cong no.
7. Them login/RBAC.
8. Them in bill va Customer 360.
