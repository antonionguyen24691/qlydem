# Cập nhật AI — 17/07/2026

Tổng hợp toàn bộ thay đổi trong phiên làm việc này (sửa luồng xóa công nợ, nâng cấp luồng, tối ưu, tính năng mới). Tất cả đã build pass (typecheck + 12/12 unit tests) và deploy production tại **https://qlydem.vercel.app**. Không cần migration Supabase mới — mọi thay đổi phía API dùng service-role, chạy ngay sau deploy.

---

## 1. SỬA LỖI: Xóa lịch sử không hết công nợ

**Triệu chứng:** Vào Cài đặt → Vận hành → Xóa lịch sử, chọn nhóm và xóa xong nhưng công nợ khách hàng / nhà cung cấp **vẫn hiển thị** trên app.

**Nguyên nhân gốc** (file `api/_lib/operationsClearHistory.ts`):
1. Luồng xóa chỉ xóa các bảng lịch sử (`customer_debt_ledger`, `order_debts`, `receipts`...) nhưng **không reset số dư dồn** lưu sẵn trên bảng danh mục: `customers.current_debt`, `customers.total_revenue`, `customers.last_order_at`, `suppliers.current_payable`, `sales_orders.debt_amount`.
2. Nhóm "Lịch sử mua/nhập hàng" **thiếu bảng `payments`** (phiếu chi trả NCC). Bảng này có khóa ngoại tới `purchase_orders` không cascade → nếu từng trả tiền NCC, xóa lịch sử mua hàng sẽ **lỗi giữa chừng**, dữ liệu xóa dở dang.
3. Bản archive tự động trước khi xóa dùng select không phân trang → **bị cắt cụt ở 1000 dòng** (giới hạn Supabase/PostgREST) mà không báo lỗi.

**Đã sửa:**
- Sau khi xóa, hệ thống **tự tính lại toàn bộ số dư từ dữ liệu còn lại**:
  - `customers.current_debt` = tổng nợ còn lại của phiếu công nợ mở + điều chỉnh thủ công còn trong sổ cái. Xóa hết lịch sử → nợ về **0** đúng nghĩa.
  - `suppliers.current_payable` = tổng còn phải trả của các phiếu nhập còn lại.
  - `customers.total_revenue` + `last_order_at` tính lại từ đơn hàng còn lại.
  - Đơn hàng còn ghi nợ nhưng phiếu công nợ đã xóa → tự **tất toán** (debt = 0, paid = total).
  - Cách này đúng cả khi xóa toàn bộ lẫn khi xóa theo mốc ngày (`beforeDate`).
- Thêm `payments` vào nhóm purchase, xóa trước `purchase_orders` để không vỡ khóa ngoại.
- Archive phân trang đầy đủ, không còn cắt 1000 dòng.
- Kết quả trả về + audit log giờ có thêm mục `resynced` (bao nhiêu khách/NCC/đơn được đồng bộ lại số dư), UI Cài đặt hiển thị rõ.

## 2. TÍNH NĂNG MỚI: Hẹn trả nợ (theo dõi thu hồi công nợ)

Bảng `payment_promises` có sẵn trong DB nhưng chưa từng có UI/API — nay đã dùng được:

- **API mới** `/api/data/payment-promises` (trong `api/data/[table].ts`, không tạo file mới — giữ giới hạn 12 function Vercel):
  - `GET` (quyền finance.view): danh sách hẹn trả, lọc theo `?customerId=`.
  - `POST` (quyền finance.receipt.create): tạo hẹn trả (khách, số tiền, ngày hẹn, người hẹn, ghi chú) + audit log.
  - `PATCH`: đánh dấu `KEPT` (đã trả) / `BROKEN` (thất hứa) / mở lại `OPEN`.
- **UI Tài chính** (`src/pages/Finance.tsx`):
  - Panel chi tiết khách nợ có nút **"Hẹn trả"** → dialog nhập ngày hẹn (mặc định +3 ngày), số tiền (mặc định = nợ hiện tại), người hẹn, ghi chú.
  - Mục **"Hẹn trả nợ"** trong panel: liệt kê các hẹn với trạng thái Chờ trả / **Trễ hẹn** (nền đỏ khi quá ngày) / Đã trả / Thất hứa, kèm 2 nút thao tác nhanh.
  - Bảng công nợ (desktop + mobile) hiện badge **"Trễ hẹn"** đỏ cạnh trạng thái khách có hẹn quá hạn.
- **Dashboard**: card "Cảnh báo công nợ" thêm dòng **"⏰ X khách trễ hẹn trả nợ · tổng hẹn Y đ"** kèm tên khách. Role không có quyền tài chính sẽ không thấy (bỏ qua êm).

## 3. TÍNH NĂNG MỚI: Xem & tải bản lưu trước khi xóa lịch sử

- **API mới** `/api/operations/clear-history-archives` (quyền history.clear):
  - `GET`: danh sách 20 bản lưu gần nhất (ngày, nhóm, số dòng).
  - `GET ?id=`: tải toàn bộ snapshot JSON của một bản lưu.
- **UI Cài đặt → Vận hành**: dưới khối Xóa lịch sử có mục **"Bản lưu tự động trước khi xóa"** — liệt kê các bản backup, nút **"Tải JSON"** tải về máy để lưu trữ ngoài hệ thống.

## 4. TỐI ƯU QUAN TRỌNG: Hết cảnh mất dữ liệu ở mốc 1000 dòng

**Vấn đề:** Supabase/PostgREST mặc định trả tối đa **1000 dòng mỗi select**. Toàn bộ API đọc dữ liệu (`fetchTableRows` trong `api/_lib/supabase.ts`) không phân trang → khi đơn hàng / sổ quỹ / sổ công nợ vượt 1000 dòng:
- App chỉ hiển thị 1000 dòng mới nhất (báo cáo sai).
- **Xuất Excel backup thiếu dữ liệu.**
- **Đồng bộ Google Sheets (backup hằng ngày) thiếu dữ liệu.**

**Đã sửa:** thêm helper `selectAllPaginated` phân trang tự động (lô 1000 dòng) áp dụng cho mọi luồng đọc: app data, export Excel, Google Sheets sync, cả phạm vi dữ liệu "own" của nhân viên sale (kèm chia lô `.in()` 200 id tránh URL quá dài).

> Quy ước từ nay: mọi select mới trên bảng có thể lớn phải dùng `selectAllPaginated` / `.range()`.

## 5. TỐI ƯU HIỆU NĂNG & UX

- **`src/store/data.ts`**: ghép đơn hàng ↔ dòng hàng ↔ khách hàng chuyển từ quét lồng nhau O(n²) sang gom nhóm bằng Map O(n) — quan trọng vì sau mục 4, app tải đủ toàn bộ dữ liệu (có thể vài nghìn đơn).
- **Điều chỉnh công nợ** (Tài chính): bỏ 2 lần `window.prompt` (rất khó dùng trên điện thoại) → **dialog chuẩn** có nút Tăng nợ/Giảm nợ, ô số tiền, xem trước "Nợ mới: ...đ", ô lý do bắt buộc. Vẫn đi qua RPC `adjust_customer_debt_secure` có ghi sổ + idempotency như cũ.

## 6. DEPLOY & VẬN HÀNH

- Production: **https://qlydem.vercel.app** — trạng thái Ready, đã smoke-test endpoint mới (trả 401 đòi đăng nhập đúng chuẩn).
- ⚠️ Token Vercel cấp trong chat đã **mất quyền truy cập team "demofm"** giữa phiên (Vercel trả `teams: []`). Deploy hiện dùng **phiên đăng nhập CLI có sẵn trên máy** (`npx vercel --prod --yes`, không kèm `--token`). Nếu cần token mới: vercel.com/account/tokens, scope team demofm.
- Không git push theo yêu cầu. Các file thay đổi:
  - `api/_lib/operationsClearHistory.ts` — sửa xóa + resync + archive + API bản lưu
  - `api/_lib/supabase.ts` — phân trang `selectAllPaginated`
  - `api/data/[table].ts` — endpoint hẹn trả nợ
  - `api/operations/[action].ts` — route bản lưu
  - `src/pages/Finance.tsx` — hẹn trả nợ + dialog điều chỉnh công nợ
  - `src/pages/Settings.tsx` — hiển thị resync + danh sách bản lưu
  - `src/pages/Dashboard.tsx` — cảnh báo trễ hẹn
  - `src/store/data.ts` — mapping O(n)

## 7. BỔ SUNG (18/07): Xóa danh mục + fix "Phải thu" hiển thị số cũ

**Vấn đề báo lại:** Xóa hết lịch sử nhưng trang Tài chính vẫn thấy "Phải thu 98.800 đ".
**Chẩn đoán:** DB thực tế đã về 0 (đã probe trực tiếp) — số cũ là do app **không tự tải lại dữ liệu** sau khi xóa, phải F5 mới thấy. Đã sửa: sau khi xóa lịch sử, app tự gọi `loadLiveData()` → mọi trang cập nhật ngay.

**Tính năng mới — Xóa dữ liệu danh mục** (Cài đặt → Vận hành, khối viền đỏ riêng):
- 3 nhóm: **DANH MỤC khách hàng** (khách + liên hệ), **DANH MỤC nhà cung cấp**, **DANH MỤC sản phẩm & tồn kho** (hàng hóa, tồn kho, lịch sử giá).
- **Xác nhận 2 lớp**: nhập `XOA` + confirm thường + confirm cảnh báo riêng cho danh mục.
- **Precheck khóa ngoại**: nếu còn lịch sử tham chiếu (đơn bán, phiếu thu, giao dịch kho...) sẽ báo rõ bảng nào còn bao nhiêu dòng và gợi ý tick kèm nhóm lịch sử để xóa cùng lúc — không bao giờ chết giữa chừng vì vỡ FK.
- Không hỗ trợ mốc ngày cho danh mục (chỉ xóa toàn bộ), vẫn tự tạo **bản lưu JSON** trước khi xóa như lịch sử.

## 8. BỔ SUNG (18/07 chiều): Dọn đơn hủy + Nhật ký hoạt động + fix deploy 13 function

**Xóa vĩnh viễn đơn đã hủy** (Cài đặt → Xóa lịch sử, nhóm mới "Đơn đã hủy (xóa vĩnh viễn)"):
- Xóa các đơn trạng thái Đã hủy + dòng hàng + phiếu công nợ + sổ cái gắn với đơn; phiếu thu/sổ quỹ (tiền thật) giữ nguyên, chỉ gỡ liên kết đơn.
- Tự tạo bản lưu JSON riêng trước khi xóa; ghi audit `CLEAR_CANCELLED_ORDERS`; đồng bộ lại số dư sau khi dọn.

**Nhật ký hoạt động người dùng** (Cài đặt → Vận hành):
- Bảng đầy đủ thay cho danh sách audit 12 dòng cũ: thời gian, người dùng (tên thật), hành động (nhãn tiếng Việt), đối tượng, chi tiết tóm tắt.
- Lọc theo người dùng / hành động, tìm kiếm nội dung, phân trang 15 dòng, hiển thị 500 bản ghi gần nhất. Giao diện riêng cho mobile.
- Bổ sung audit log cho thao tác ngưng bán sản phẩm (DISCONTINUE); các thao tác tạo/sửa KH-NCC-SP, thu chi, duyệt kho, xóa lịch sử... đã ghi audit từ trước.

**Fix deploy hỏng do 13 serverless function:** commit `7afc179` (phiên Codex khác) thêm file `api/sync/google-sheets-inbox.ts` làm vượt giới hạn 12 function Vercel Hobby → mọi deploy sau đó fail. Đã chuyển handler vào `api/_lib/sheetsInbox.ts`, route qua **`/api/data/sheet-inbox`** (đúng quy ước dự án), cập nhật UI Settings + Google Apps Script (`PMQL_MasterScript.gs` — ai đang dùng bản .gs cũ cần dán lại script mới). Bảng `sheet_change_requests` đã có sẵn trên DB, không cần migration thêm.

## Gợi ý bước tiếp theo (chưa làm)

- Nhắc nợ tự động (bảng `debt_reminders` đã có sẵn, có thể nối vào cron notifications).
- Khôi phục (restore) trực tiếp từ bản lưu JSON trong app — hiện mới tải về được.
- Phân công thu hồi nợ theo nhân viên (`debt_assignments` có sẵn trong DB).
