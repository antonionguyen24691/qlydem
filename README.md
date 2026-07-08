# PMQL

Ứng dụng quản lý bán hàng vật liệu xây dựng, phát triển từ workbook nghiệp vụ `NHAT KY BAN HANG.xlsx`.

## Nền vận hành hiện có

- Frontend: React 19, Vite, Tailwind CSS, Zustand.
- Deploy: Vercel static frontend + Serverless Functions trong `api/`.
- Database chính: Supabase Postgres.
- Đồng bộ theo dõi: Supabase -> Google Sheets.
- Xuất dữ liệu: endpoint tải `.xlsx`.
- Roadmap sản phẩm: `ROADMAP.md`.
- Hướng dẫn vận hành: `docs/OPERATIONS.md`.
- Hướng dẫn gắn Vercel: `docs/VERCEL_SETUP.md`.
- Schema database: `supabase/schema.sql`.

## Chạy local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Điền các biến Supabase/Google Sheets trong `.env.local` nếu cần chạy API thật.

## Kiểm tra

```powershell
npm run lint
npm run build
npm run audit
```

## API nền

```http
GET /api/health
GET /api/data/customers
GET /api/templates/products
POST /api/import/products
POST /api/orders/create
POST /api/receipts/create
POST /api/sync/google-sheets?tables=customers,products
GET /api/export/xlsx?tables=customers,products
```

Các endpoint nghiệp vụ cần đăng nhập Google và gửi bearer token:

```http
Authorization: Bearer <supabase_access_token>
```

## Deploy Vercel

```powershell
npx --yes vercel link
npm run deploy:vercel
```

Xem chi tiết env và quy trình tại `docs/OPERATIONS.md`.
