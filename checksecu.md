# CHECKSECU — Rà soát bảo mật & lỗi còn lại của app PMQL

Ngày rà soát: 2026-07-10
Phạm vi: toàn bộ `api/`, `src/`, `supabase/`, cấu hình deploy (`vercel.json`, `.env*`).
Người thực hiện: rà soát tự động theo yêu cầu, sau đợt nâng cấp kho/chi phí/quỹ/POS ngày 2026-07-10.

## 0. Tóm tắt điều hành

Nền tảng bảo mật của app **khá tốt cho pilot nội bộ**: mọi API nghiệp vụ đều xác thực bằng Supabase bearer token, tra user ACTIVE, có ma trận quyền (`permissions_json`), service_role chỉ dùng ở server, giao dịch POS/thu tiền/nhập kho đã đưa vào RPC transaction có khóa dòng + idempotency, có CSP/robots/cron secret, và không có lỗ hổng phụ thuộc (`npm audit` = 0).

Tuy nhiên còn **một số việc phải làm trước khi mở rộng người dùng / lên production thật**. Xếp theo mức độ:

| Mức | Số vấn đề | Nội dung chính |
|-----|-----------|----------------|
| 🔴 P0 (chặn production) | 3 | RLS chưa có policy, cần apply migration mới, secret Firebase trong repo |
| 🟠 P1 (quan trọng) | 6 | RPC mới chưa có test tồn âm giá override, rate-limit, phân quyền chi phí, logo/branding SSRF, header thiếu ở API con, clear-history không giới hạn thời gian |
| 🟡 P2 (nên làm) | 7 | POS draft localStorage, popup bill, thiếu ràng buộc ngày/số tiền, audit thiếu vài chỗ, v.v. |

**Việc quan trọng nhất ngay lúc này:** apply migration `20260711_expense_fund_price_override.sql` **trước** khi deploy code mới, và xác nhận RLS đã bật thật trên Supabase (migration khai báo RLS nhưng chưa được xác nhận đã chạy trên DB thật).

---

## 1. 🔴 P0 — Chặn production

### P0-1. RLS bật nhưng CHƯA có policy trên bảng nghiệp vụ
- **Chứng cứ:** `supabase/migrations/20260710_secure_transactions_rls.sql` (dòng 442-460) chạy `enable row level security` + `revoke all ... from anon, authenticated` cho ~39 bảng, nhưng **không tạo `create policy` nào**. `supabase/schema.sql` cũng không có policy.
- **Rủi ro:** Với service_role (server API) thì RLS bị bỏ qua nên app vẫn chạy. Nhưng nếu **bất kỳ client nào cầm anon key** (anon key nằm ở frontend, công khai) và Supabase project bật quyền đọc mặc định cho `authenticated`/`anon`, dữ liệu có thể lộ. `revoke all` đã giảm rủi ro này, nhưng cần **xác nhận trực tiếp trên Supabase Dashboard** rằng không có bảng nào còn grant cho `anon`/`authenticated`, và không có policy "allow all".
- **Việc cần làm:**
  1. Chạy trên Supabase SQL Editor: kiểm tra `select * from pg_policies;` — xác nhận đúng như kỳ vọng.
  2. Kiểm tra `information_schema.role_table_grants` cho `anon`/`authenticated` = rỗng trên các bảng nghiệp vụ.
  3. Nếu về sau cho client truy vấn trực tiếp Supabase (không qua API), phải viết policy theo `assigned_sale_id` / `role`.
- **Trạng thái:** ⚠️ Chưa xác nhận trên DB thật.

### P0-2. Phải apply migration mới trước khi deploy code
- **Chứng cứ:** `api/orders/create.ts` giờ gọi `create_sales_order_secure` với tham số thứ 11 `p_allow_price_override`; `api/data/[table].ts` ghi `cashbook_entries` với cột `category/person/entry_date`. Các thứ này chỉ tồn tại sau khi chạy `supabase/migrations/20260711_expense_fund_price_override.sql`.
- **Rủi ro:** Deploy code trước khi apply SQL ⇒ nút Thanh toán POS lỗi "function ... does not exist", ghi chi phí lỗi "column does not exist".
- **Việc cần làm:** Apply migration `20260711` trên Supabase **trước**, rồi mới `npm run deploy:vercel`.
- **Trạng thái:** ⚠️ Bắt buộc theo đúng thứ tự.

### P0-3. Secret Firebase/Google API key được commit vào repo
- **Chứng cứ:** `firebase-applet-config.json` (đang được git track) chứa `apiKey: "AIzaSyBcT7BtLpUXvCFUusEqec7r2etnqkxn-qg"`, `projectId`, `appId`, `messagingSenderId`.
- **Đánh giá:** Firebase web apiKey **không phải secret tuyệt mật** (thiết kế để lộ ở client), nhưng: (a) file này **không được app dùng** (grep `firebase` trong `src/` = 0 kết quả) → là rác cấu hình; (b) nếu Firebase project có bật dịch vụ tính phí mà không giới hạn domain/API restriction, key lộ có thể bị lạm dụng.
- **Việc cần làm:**
  1. Xóa `firebase-applet-config.json` khỏi repo nếu không dùng (`git rm firebase-applet-config.json`).
  2. Nếu còn dùng: thêm API key restriction (HTTP referrer) trong Google Cloud Console.
  3. `.env.local` **KHÔNG** bị track (đã xác nhận `git ls-files` chỉ có `.env.example`) → OK.
- **Trạng thái:** ❌ Cần dọn.

---

## 2. 🟠 P1 — Quan trọng

### P1-1. RPC sửa giá/ĐVT khi bán chưa được kiểm thử tồn âm & lạm quyền
- **Chứng cứ:** migration `20260711` cho phép `p_allow_price_override` ghi đè `unit_price`/`unit` theo từng dòng. `api/orders/create.ts` chỉ gửi cờ này khi `hasPermission(actor, "orders.price_override")`.
- **Rủi ro còn lại:** override cho phép giá = 0 (bán phá giá) mà không cảnh báo; ĐVT tự do không kiểm tra. Nếu logic phân quyền sai (ví dụ role SALE vô tình được cấp `orders.price_override`), nhân viên có thể tự đặt giá.
- **Việc cần làm:** kiểm thử: (a) role SALE gửi `unitPrice` → server phải bỏ qua (đã chặn ở API vì `canOverridePrice=false`, cần test thực tế); (b) giá 0 → quyết định có chặn không; (c) đảm bảo `price_edit_logs`/audit ghi lại khi override (hiện chỉ ghi cờ trong audit_logs của đơn, chưa ghi chi tiết dòng).
- **Trạng thái:** 🟠 Cần test + cân nhắc log chi tiết.

### P1-2. Không có rate-limiting / brute-force protection
- **Chứng cứ:** `signInWithPassword` (`src/store/auth.ts`) và mọi API đều không giới hạn số lần gọi. `upsertAuthPassword` chỉ yêu cầu mật khẩu ≥ 8 ký tự.
- **Rủi ro:** dò mật khẩu, spam tạo đơn/chi phí, lạm dụng endpoint export (tải toàn bộ DB ra XLSX).
- **Việc cần làm:** bật rate-limit ở tầng Vercel (middleware) hoặc Supabase Auth rate-limit; giới hạn tần suất `/api/export/*` và `/api/data/cashbook-transactions`.
- **Trạng thái:** 🟠 Chưa có.

### P1-3. Phân quyền nghiệp vụ quỹ/chi phí còn rộng
- **Chứng cứ:** endpoint mới `cashbook-transactions` (`api/data/[table].ts`) chỉ yêu cầu `finance.receipt.create`. Nghĩa là bất kỳ ai lập được phiếu thu (ADMIN + ACCOUNTANT) đều **rút quỹ, chuyển quỹ, ghi chi phí** được. `ADJUST` (điều chỉnh số dư) đã giới hạn đúng chỉ ADMIN.
- **Rủi ro:** kế toán có thể tự ghi phiếu rút quỹ mà không cần cấp quyền riêng; thiếu tách quyền "chi tiền" khỏi "thu tiền".
- **Việc cần làm:** cân nhắc thêm permission riêng `finance.expense.create` / `finance.fund.manage` trong `permissionCatalog` và gate riêng. Trước mắt chấp nhận được vì chỉ ADMIN/ACCOUNTANT nội bộ.
- **Trạng thái:** 🟠 Nên tách quyền.

### P1-4. Branding logoUrl / faviconUrl nhận URL tùy ý (nguy cơ SSRF gián tiếp & lộ IP)
- **Chứng cứ:** `api/settings/index.ts` `normalizeBranding` lưu `logoUrl`, `faviconUrl` là string bất kỳ. Bill in ra (`printBill.ts`) và `<img>` render trực tiếp URL này. CSP `img-src` cho phép `data: blob: https://img.vietqr.io self` — nghĩa là ảnh ngoài domain khác sẽ bị CSP chặn ở app chính, nhưng bill mở bằng `window.open`+`document.write` (popup) **không chịu CSP của trang gốc**.
- **Rủi ro:** admin (hoặc kẻ chiếm được quyền settings) đặt logoUrl trỏ tới URL độc hại; khi in bill, trình duyệt client tải ảnh đó (lộ IP/referrer). Mức thấp vì cần quyền `settings.manage`.
- **Việc cần làm:** validate `logoUrl`/`faviconUrl` chỉ nhận `https://` hoặc `data:image/...`; hoặc chỉ cho upload lên storage của mình.
- **Trạng thái:** 🟠 Nên validate.

### P1-5. Escape HTML trong bill — đã có, nhưng logoUrl/qrUrl chưa lọc scheme
- **Chứng cứ:** `printBill.ts` có `escapeHtml()` cho tất cả text (tốt, chặn XSS qua tên KH/hàng hóa). Nhưng `info.logoUrl` và `qrUrl` được nhét vào `src="..."` qua `escapeHtml` — escapeHtml chặn được `"` nên không breakout attribute được, **nhưng không chặn `javascript:` scheme**. Với `<img src>` thì `javascript:` không thực thi nên rủi ro thấp; tuy vậy nên kiểm tra scheme cho chắc.
- **Việc cần làm:** thêm hàm `safeUrl()` chỉ cho `http(s):`/`data:image`.
- **Trạng thái:** 🟡→🟠 Thấp nhưng nên làm cùng P1-4.

### P1-6. `clear-history` không giới hạn khoảng thời gian & phụ thuộc archive in-memory
- **Chứng cứ:** `api/_lib/operationsClearHistory.ts` xóa **toàn bộ** bảng theo nhóm (`.delete().not("id","is",null)`), archive bằng cách `select("*")` toàn bộ vào JSON (`MAX_ARCHIVE_ROWS = 20000`). Nếu >20k dòng thì chặn — nhưng dưới ngưỡng vẫn xóa sạch, không cho lọc "chỉ xóa trước ngày X".
- **Rủi ro:** một thao tác nhầm của admin xóa toàn bộ lịch sử; archive nằm trong 1 row JSON, phục hồi thủ công khó.
- **Việc cần làm:** thêm điều kiện lọc theo ngày (chỉ xóa dữ liệu cũ hơn N tháng); cân nhắc export ra file trước khi xóa. Đã có audit + snapshot nên chấp nhận được cho nội bộ.
- **Trạng thái:** 🟠 Nên thêm bộ lọc ngày.

---

## 3. 🟡 P2 — Nên làm

### P2-1. POS draft lưu thông tin khách trong localStorage
- `src/pages/POS.tsx`: `POS_DRAFT_KEY` lưu `cart`, `selectedCustomer`, `customerPaid` vào `localStorage` (TTL 24h — đã có). Thông tin khách (tên, nợ cũ) nằm ở localStorage máy dùng chung có thể lộ. Cân nhắc chỉ lưu id + không lưu nợ.

### P2-2. Popup bill dùng `document.write` + gán `window.shareBill`
- `printBill.ts` dùng `popup.document.write(billHtml(...))`. Nội dung đã escape nên an toàn XSS, nhưng `document.write` là pattern cũ; cân nhắc render bằng Blob URL. Không gấp.

### P2-3. Giá vốn báo cáo là ước tính (không phải giá vốn tại thời điểm bán)
- `src/pages/Expenses.tsx` tính COGS theo `product.cost` hiện tại (bình quân gia quyền mới nhất), không phải giá vốn lúc bán. Đã ghi chú rõ trên UI. Đây là **vấn đề chính xác số liệu**, không phải bảo mật — nhưng cần người dùng hiểu để không quyết toán sai.

### P2-4. Thiếu ràng buộc ngày nhập/chi ở tương lai
- `entry_date`, `receivedAt` nhận ngày bất kỳ (kể cả tương lai/quá khứ xa). Nên chặn ngày > hôm nay để tránh sai sổ.

### P2-5. `toNumber` strip ký tự có thể tạo số ngoài ý muốn
- `api/_lib/body.ts` `toNumber("1-2-3")` → `NaN`→fallback; `"1.2.3"` → `Number("1.2.3")`=NaN→fallback. Ổn. Nhưng `"12abc34"` → `"1234"` → 1234. Rủi ro thấp (chỉ ảnh hưởng dữ liệu do chính user nhập), nhưng nên validate chặt số tiền/số lượng phía client.

### P2-6. Audit log không phủ hết
- Nghiệp vụ quỹ mới (`cashbook-transactions`) **đã** ghi audit (tốt). Nhưng `roles` POST (`api/roles/index.ts`) — thay đổi ma trận quyền — **không ghi audit_logs**. Thay đổi quyền là hành vi nhạy cảm, nên ghi lại.

### P2-7. Header bảo mật chỉ set đầy đủ ở `vercel.json` routes, một số API tự set lẻ
- `sendError`/`methodNotAllowed` set `X-Content-Type-Options`, `Referrer-Policy`… nhưng response thành công của nhiều API không tự set (dựa vào `vercel.json`). Khi chạy ngoài Vercel (preview/local) sẽ thiếu header. Chấp nhận được vì production chạy trên Vercel.

---

## 4. Những điểm ĐÃ tốt (xác nhận trong code)

- ✅ Mọi API nghiệp vụ dùng `requireAuth`/`requirePermission`, tra `users` ACTIVE, đọc `permissions_json` từ bảng `roles`.
- ✅ POS/thu tiền/nhập kho chạy qua **RPC security-definer** có `pg_advisory_xact_lock`, khóa dòng tồn `for update`, chặn tồn âm, `idempotency_keys` unique → double-click không tạo chứng từ trùng.
- ✅ Server **không tin** `saleId`/`createdBy`/giá từ client trừ khi có quyền (`orders.price_override`); actor luôn lấy từ token.
- ✅ Service_role key chỉ ở server (`api/_lib/supabase.ts`), frontend chỉ có anon key cho Auth.
- ✅ Cron `google-sheets`/`notifications` bảo vệ bằng `CRON_SECRET` (Bearer), fallback về `requirePermission` khi gọi thủ công.
- ✅ Import Excel: giới hạn 10MB + 5000 dòng, có dry-run, chặn formula injection (`'` prefix cho `=+-@`).
- ✅ Bill in ra escape HTML → chặn XSS qua tên khách/hàng hóa.
- ✅ CSP chặt (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), robots noindex, `X-Frame-Options: DENY`.
- ✅ `npm audit` = 0 lỗ hổng.
- ✅ Clear-history có xác nhận "XOA", chọn nhóm, snapshot archive trước khi xóa, ghi audit.
- ✅ Đồng bộ Google Sheets đã chuyển fire-and-forget (không chặn phản hồi POS/thu tiền).

---

## 5. Checklist hành động (ưu tiên)

- [ ] **P0-2** Apply `supabase/migrations/20260711_expense_fund_price_override.sql` trước khi deploy.
- [ ] **P0-1** Kiểm tra `pg_policies` + `role_table_grants` trên Supabase; xác nhận không lộ cho anon/authenticated.
- [ ] **P0-3** `git rm firebase-applet-config.json` (nếu không dùng) hoặc thêm API key restriction.
- [ ] **P1-2** Thêm rate-limit cho `/api/auth`, `/api/export/*`, `/api/data/cashbook-transactions`.
- [ ] **P1-3** Tách permission `finance.fund.manage` / `finance.expense.create`.
- [ ] **P1-4/P1-5** Validate scheme `logoUrl`/`faviconUrl` (`https:`/`data:image`), thêm `safeUrl()` cho bill.
- [ ] **P1-1** Test tồn âm + override giá + role SALE không được sửa giá; cân nhắc log chi tiết dòng override.
- [ ] **P1-6** Thêm bộ lọc theo ngày cho clear-history.
- [ ] **P2-6** Ghi audit khi đổi `roles`.
- [ ] **P2-4** Chặn ngày chi/nhập ở tương lai.
- [ ] **P2-1** Giảm dữ liệu khách lưu trong POS draft localStorage.

---

## 6. Ghi chú kiểm thử đề xuất (trước khi mở rộng người dùng)

1. Đăng nhập role SALE → gọi thẳng `POST /api/data/cashbook-transactions` (rút quỹ) → phải bị 403.
2. Gửi đơn với `unitPrice: 0` và role SALE → giá phải lấy từ catalog, không phải 0.
3. Bấm Thanh toán 2 lần liên tiếp (cùng idempotency-key) → chỉ 1 đơn.
4. Ghi chi phí với `amount` âm/chuỗi → phải bị từ chối.
5. Chuyển quỹ: xác nhận đúng 2 bút toán OUT+IN, số dư 2 quỹ khớp; nếu insert lỗi giữa chừng → không có bút toán mồ côi (đã gộp 1 insert).
6. Đổi ĐVT trên phiếu nhập kho → kiểm tra `products.unit` cập nhật + audit `UPDATE_UNIT`.
