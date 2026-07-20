# Kế hoạch triển khai Quản lý Lô hàng (Số lô)

## ✅ TRẠNG THÁI TRIỂN KHAI (cập nhật)

Đã code xong & build/typecheck sạch — **CHƯA chạy trên Supabase, CHƯA test end-to-end**.

| GĐ | Nội dung | Trạng thái | File |
|----|----------|-----------|------|
| G1 | Migration nền lô | ✅ | `supabase/migrations/20260721_lot_tracking.sql` |
| G2 | Trigger đồng bộ tồn lô + nhập sinh lô | ✅ | `supabase/migrations/20260722_lot_stock_sync.sql` |
| G3 | Bán/trả hàng theo lô + giá vốn lô | ✅ | `supabase/migrations/20260723_lot_sales_returns.sql` |
| G4 | API + Bill | ✅ | `api/orders/create.ts`, `api/_lib/exportBillXlsx.ts`, `api/data/[table].ts`, `api/_lib/supabase.ts` |
| G5 | Frontend (POS chọn lô, nhập lô, bật cờ, bill) | ✅ | `src/store/pos.ts`, `src/store/data.ts`, `src/pages/POS.tsx`, `src/components/pos/LotPickerModal.tsx`, `src/pages/Bill.tsx`, `src/lib/printBill.ts`, `src/components/inventory/InventoryReceiptDialog.tsx`, `src/pages/Products.tsx` |
| G6 | Sheets sync + Master script | ✅ | `scripts/sync-supabase-to-google-sheets.mjs`, `scripts/google-apps-script/PMQL_MasterScript.gs` |
| G7 | Xem tồn theo lô ở Kho + lô khi trả hàng | ⏳ còn lại (read-only) | `src/pages/Inventory.tsx`, `src/components/orders/ReturnOrderDialog.tsx` |

### ⚠️ CHECKPOINT BẮT BUỘC trước khi deploy
Chạy **theo đúng thứ tự** trên Supabase (SQL Editor hoặc CLI):
1. `20260721_lot_tracking.sql`
2. `20260722_lot_stock_sync.sql`
3. `20260723_lot_sales_returns.sql`

Rồi mới deploy code. Kiến trúc **trigger-centric**: `inventory_transactions_sync_lot` tự đồng bộ
`inventory_lot_balances` cho mọi biến động (FIFO khi không chỉ định lô), giữ bất biến
`sum(tồn lô) = tồn tổng`. Giá vốn theo `settings.costing_method` (mặc định `LOT`).

---


> Mục tiêu: cùng một mã hàng nhưng nhập ở thời điểm/NCC khác nhau → tách thành **lô** riêng để phân biệt
> chất lượng, màu sắc, hình ảnh. Lô chạy xuyên suốt: **Nhập → Tồn → Bán → Bill**.
>
> Quyết định đã chốt với chủ hệ thống:
> - **Giá vốn theo lô (đích danh)** là mặc định, có cờ `settings` để chuyển về bình quân.
> - **Bán hàng: nhân viên bấm → tìm lô → chọn lô** (search UI, có mã lô/ngày nhập/tồn/ảnh).

---

## A. Bản chất thay đổi

Độ chi tiết (granularity) tồn kho đổi từ `(kho × sản phẩm)` → `(kho × sản phẩm × lô)`.
Đây KHÔNG phải thêm một cột, mà là thêm một chiều dữ liệu chạy qua toàn chuỗi.

Nguyên tắc thiết kế để **không vỡ hệ thống đang chạy**:
1. Giữ nguyên `inventory_balances` cũ làm **tổng (rollup)** = tổng các lô. Mọi màn hình/report cũ chạy tiếp.
2. Thêm bảng chi tiết `inventory_lot_balances` bên cạnh.
3. Mọi cột `lot_id` mới đều **nullable** → dữ liệu cũ hợp lệ.
4. Migrate tồn hiện có thành 1 "lô tồn đầu kỳ" để không mất dấu.

---

## B. Mô hình dữ liệu (Giai đoạn 1 — migration)

File mới: `supabase/migrations/20260721_lot_tracking.sql`

```sql
-- 1) Bảng lô hàng: mỗi lần nhập tạo 1 lô
create table if not exists public.product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id),
  lot_code      text not null,                 -- LOT-YYMMDD-xxx hoặc số lô của NCC (sửa được)
  supplier_id   uuid references public.suppliers(id),
  purchase_id   uuid references public.purchase_orders(id),
  received_date timestamptz not null default now(),
  unit_cost     numeric not null default 0,    -- GIÁ VỐN ĐÍCH DANH của lô
  color_note    text,
  quality_note  text,
  image_urls    jsonb not null default '[]',   -- ẢNH RIÊNG của lô
  status        text not null default 'ACTIVE',-- ACTIVE / SOLD_OUT / BLOCKED
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, lot_code)
);

-- 2) Tồn theo lô (chi tiết) — inventory_balances cũ giữ nguyên làm tổng
create table if not exists public.inventory_lot_balances (
  id uuid primary key default gen_random_uuid(),
  warehouse_id  uuid not null references public.warehouses(id),
  product_id    uuid not null references public.products(id),
  lot_id        uuid not null references public.product_lots(id),
  quantity_box   numeric not null default 0,
  quantity_piece numeric not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (warehouse_id, lot_id)
);

-- 3) Cột lô ở các bảng giao dịch (nullable → dữ liệu cũ hợp lệ)
alter table public.purchase_order_items add column if not exists lot_id uuid references public.product_lots(id);
alter table public.sales_order_items    add column if not exists lot_id uuid references public.product_lots(id);
alter table public.sales_order_items    add column if not exists lot_code text;
alter table public.inventory_transactions add column if not exists lot_id uuid references public.product_lots(id);

-- 4) Cờ bật lô theo sản phẩm + cờ phương pháp giá vốn
alter table public.products add column if not exists track_lots boolean not null default false;
-- settings: costing_method = 'LOT' | 'AVERAGE' (đọc trong RPC)

-- 5) MIGRATE TỒN CŨ → lô tồn đầu kỳ
insert into public.product_lots (product_id, lot_code, unit_cost, received_date, status)
select p.id, 'TON-DAU-KY', coalesce(p.cost_price,0), now(), 'ACTIVE'
from public.products p
where exists (select 1 from public.inventory_balances b where b.product_id = p.id and b.quantity_box > 0)
  and not exists (select 1 from public.product_lots l where l.product_id = p.id and l.lot_code = 'TON-DAU-KY');

insert into public.inventory_lot_balances (warehouse_id, product_id, lot_id, quantity_box, quantity_piece)
select b.warehouse_id, b.product_id, l.id, b.quantity_box, b.quantity_piece
from public.inventory_balances b
join public.product_lots l on l.product_id = b.product_id and l.lot_code = 'TON-DAU-KY'
where b.quantity_box > 0
on conflict (warehouse_id, lot_id) do nothing;
```

Còn cần: index `(product_id, status)` trên `product_lots`, `(warehouse_id, product_id)` trên
`inventory_lot_balances`; RLS + grant giống các bảng khác; thêm 2 bảng vào realtime nếu cần.

> ⚠️ Quy tắc dự án: **migration phải chạy trên Supabase TRƯỚC khi deploy Vercel.**

---

## C. Kế hoạch theo giai đoạn

### Giai đoạn 1 — Nền dữ liệu (migration ở mục B)
Rủi ro: thấp (chỉ thêm bảng/cột, không đụng logic). **Làm trước, review, chạy trên Supabase.**

### Giai đoạn 2 — Nhập hàng sinh lô
- **DB:** sửa `create_inventory_stock_in_secure`
  (`supabase/migrations/20260713_inventory_stock_in_secure.sql`):
  - Nhận thêm tham số lô: `p_lot_code`, `p_color_note`, `p_quality_note`, `p_image_urls`
    (hoặc `p_lot_id` nếu nhập bổ sung vào lô có sẵn).
  - Tạo `product_lots` (mặc định `LOT-YYMMDD-xxx`), ghi `inventory_lot_balances`,
    **vẫn** cập nhật `inventory_balances` tổng như cũ.
  - Ghi `unit_cost` vào lô. Giữ cập nhật bình quân trên `products.cost_price` để report cũ không lệch.
- **API:** `api/import/[entity].ts` (nếu import), `api/data/[table].ts` (đọc lô cho UI).
- **Frontend:** `src/components/inventory/InventoryReceiptDialog.tsx` + `src/pages/Inventory.tsx`
  — thêm ô mã lô, màu, chất lượng, upload ảnh lô.

Rủi ro: trung bình (đụng RPC lõi có idempotency).

### Giai đoạn 3 — Bán hàng chọn lô + giá vốn theo lô  ← phần nặng & rủi ro nhất
- **DB:** sửa `create_sales_order_secure`
  (`supabase/migrations/20260720_returns_customer_credit.sql`):
  - `p_items` mỗi dòng nhận thêm `lot_id`.
  - Trừ đúng `inventory_lot_balances` (khóa dòng, kiểm tồn lô), rồi cập nhật `inventory_balances` tổng.
  - Set `sales_order_items.lot_id` + `lot_code`.
  - Giá vốn: đọc `settings.costing_method`; nếu `LOT` → `unit_cost_snapshot = product_lots.unit_cost`
    của lô; nếu `AVERAGE` → như hiện tại. Cần điều chỉnh trigger `capture_sales_item_cost`
    (`20260711_finance_integrity_hardening.sql`) để ưu tiên giá vốn lô khi có `lot_id`.
  - Cập nhật `product_lots.status = 'SOLD_OUT'` khi tồn lô về 0.
- **Trả hàng:** sửa `create_sales_return_secure` → hoàn về **đúng lô** đã bán (đọc `lot_id` gốc).
- **API:** `api/orders/create.ts` — thêm `lotId` vào `normalizedItems` → `p_items`.
- **Frontend:** `src/pages/POS.tsx` — nút "Chọn lô" → modal search
  (mã lô, ngày nhập, tồn còn, ảnh/màu); mặc định gợi ý lô cũ nhất còn tồn (FIFO), nhân viên đổi được.
  Chỉ bắt buộc chọn lô khi `product.track_lots = true`.

Rủi ro: **cao** (idempotency + RLS + snapshot giá vốn + đồng bộ tồn tổng/tồn lô + trả hàng).
Bắt buộc có test ở `tests/`.

### Giai đoạn 4 — Hiển thị & In
- **Bill:** `api/_lib/exportBillXlsx.ts` — layout hiện 7 cột (STT/Mã/Tên/ĐVT/SL/Đơn giá/Thành tiền).
  Đơn giản nhất & đúng yêu cầu "sau tên, mã hàng": nối `(Lô: {lot_code})` vào cột **Tên hàng**
  thay vì thêm cột (giữ khổ giấy). `src/pages/Bill.tsx` hiển thị tương tự.
- **Tồn kho:** `src/pages/Inventory.tsx` — xem tồn tách theo lô (expand theo mã hàng).
- **Report:** lãi gộp theo lô (dùng `unit_cost` lô vs `unit_price`).

Rủi ro: thấp.

### Giai đoạn 5 — Tích hợp phụ (xem mục D)
Google Sheets sync, Master script, import file, change-inbox.

---

## D. Trả lời 3 câu hỏi cụ thể

### D1. File upload lô thông tin — CÓ, cần thêm nếu muốn nhập lô hàng loạt
Hiện `api/_lib/importTemplates.ts` chỉ có 3 entity: `customers | suppliers | products`.
Import `products` có tạo `opening_stock` nhưng **không tạo lô**.

- **Nếu muốn upload lô bằng Excel:** thêm entity mới, ví dụ `product_lots` (hoặc `stock_in`), với template:
  `Mã hàng, Mã lô, NCC, Ngày nhập, Số lượng, Giá vốn, Màu, Chất lượng, Ghi chú`.
  Sửa: `ImportEntity` type, `IMPORT_TEMPLATES`, `isImportEntity`, và nhánh xử lý trong
  `api/import/[entity].ts` để tạo `product_lots` + `inventory_lot_balances`.
- **Nhất quán opening_stock:** nhánh import `products` tạo tồn đầu kỳ nên **tạo kèm 1 lô `TON-DAU-KY`**
  thay vì chỉ ghi `inventory_balances`, nếu không tồn nhập bằng Excel sẽ "không có lô".
- **Nếu chỉ nhập lô qua dialog trong app** (Giai đoạn 2): **không cần** đụng import file.

→ Khuyến nghị: Giai đoạn 2 làm dialog trước; entity import lô để Giai đoạn 5 (tùy nhu cầu nhập số lượng lớn).

### D2. Google Sheets đầu ra — CÓ, nhưng rất nhẹ
`scripts/sync-supabase-to-google-sheets.mjs` dùng `select("*")` + tự suy header từ `Object.keys(row)`.
Vì vậy:
- **Cột mới** (`lot_id`, `lot_code`) trên bảng cũ → **tự động xuất hiện**, không cần sửa.
- Chỉ cần **thêm 2 tên bảng** `"product_lots"`, `"inventory_lot_balances"` vào `DEFAULT_TABLES`.

→ Effort: 1 dòng thêm 2 phần tử. Rủi ro: rất thấp.

### D3. Master script (PMQL_MasterScript.gs) — CÓ, cần sửa tay
Khác với script sync, `PMQL_TABLES` trong `scripts/google-apps-script/PMQL_MasterScript.gs`
**hard-code header từng cột**. Cần:
1. Thêm 2 định nghĩa sheet mới:
   - `product_lots`: `id, product_id, lot_code, supplier_id, purchase_id, received_date, unit_cost,
     color_note, quality_note, image_urls, status, created_at, updated_at`
   - `inventory_lot_balances`: `id, warehouse_id, product_id, lot_id, quantity_box, quantity_piece,
     created_at, updated_at`
2. Bổ sung cột `lot_id` (và `lot_code`) vào các định nghĩa sẵn có:
   `sales_order_items`, `purchase_order_items`, `inventory_transactions`.
3. (Tùy chọn) thêm metric dashboard: `lots_count`.
4. (Tùy chọn) Change-inbox: whitelist ở `supabase/migrations/20260718_google_sheets_change_inbox.sql`
   hiện là `('customers','suppliers','products')`. Nếu muốn **sửa metadata lô** (màu/chất lượng/mã lô)
   từ Google Sheet → thêm `'product_lots'` vào `check` và xử lý trong `api/_lib/sheetsInbox.ts`.
   Không bắt buộc cho MVP.

→ Effort: trung bình-thấp, sửa tay + dán lại vào Apps Script.

---

## E. Ma trận "chỗ nào cần điều chỉnh"

| Khu vực | File | Mức độ | Ghi chú |
|---|---|---|---|
| Schema | `supabase/migrations/20260721_lot_tracking.sql` (mới) | Cao | 2 bảng + 4 cột + migrate tồn cũ |
| Nhập kho RPC | `20260713_inventory_stock_in_secure.sql` | TB | Tạo lô, ghi tồn lô |
| Bán hàng RPC | `20260720_returns_customer_credit.sql` | **Cao** | Trừ tồn lô, giá vốn lô, trả hàng |
| Giá vốn trigger | `20260711_finance_integrity_hardening.sql` | TB | Ưu tiên giá vốn lô khi có lot_id |
| API bán | `api/orders/create.ts` | Thấp | Thêm `lotId` vào items |
| API bill | `api/_lib/exportBillXlsx.ts` | Thấp | Nối `(Lô: ...)` vào tên hàng |
| Import template | `api/_lib/importTemplates.ts`, `api/import/[entity].ts` | TB | Chỉ khi cần upload lô/opening_stock theo lô |
| POS | `src/pages/POS.tsx` | Cao | Modal search chọn lô |
| Nhập kho UI | `src/components/inventory/InventoryReceiptDialog.tsx`, `src/pages/Inventory.tsx` | TB | Nhập mã lô/màu/ảnh; xem tồn theo lô |
| Bill UI | `src/pages/Bill.tsx` | Thấp | Hiển thị số lô |
| Sản phẩm | `src/pages/Products.tsx` | Thấp | Bật cờ `track_lots` |
| Trả hàng UI | `src/components/orders/ReturnOrderDialog.tsx` | TB | Chọn/hiển thị lô hoàn |
| Sheets sync | `scripts/sync-supabase-to-google-sheets.mjs` | **Rất thấp** | Thêm 2 tên bảng |
| Master script | `scripts/google-apps-script/PMQL_MasterScript.gs` | TB | Thêm 2 sheet + cột lô, sửa tay |
| Change-inbox | `20260718...sql`, `api/_lib/sheetsInbox.ts` | Thấp | Tùy chọn, không bắt buộc MVP |
| Test | `tests/` | TB | Bắt buộc cho Giai đoạn 3 |

---

## F. Lưu ý ràng buộc & rủi ro

- **Vercel Hobby 12 function limit:** thay đổi chủ yếu ở DB + sửa file API sẵn có → **không tăng số
  serverless function**. An toàn với giới hạn. (Tránh tạo route API mới cho lô nếu không cần.)
- **Đồng bộ tồn tổng ↔ tồn lô:** mọi thao tác phải cập nhật cả hai trong cùng transaction, nếu không
  sẽ lệch số. Đây là rủi ro chính của Giai đoạn 3.
- **Idempotency:** RPC bán/nhập đang có idempotency key — giữ nguyên cơ chế, chỉ mở rộng payload.
- **Điều chỉnh tồn (stock count/adjustment):** `inventory_adjustment_*` hiện ở mức sản phẩm; khi bật lô
  cần quyết định kiểm kê theo lô hay theo tổng (có thể để Giai đoạn sau).

---

## G. Thứ tự đề xuất

1. **G1** migration (mục B) → chạy Supabase, review.
2. **G2** nhập kho sinh lô (RPC + dialog).
3. **G3** bán hàng chọn lô + giá vốn lô + trả hàng (có test). ← nặng nhất
4. **G4** bill + tồn kho hiển thị lô.
5. **G5** Sheets sync (1 dòng) + master script + import lô (tùy nhu cầu).
