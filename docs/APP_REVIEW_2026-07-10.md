# Đánh giá toàn bộ PMQL - 2026-07-10

## Kết luận

App hiện là một **bản pilot nội bộ có backend thật**, không còn là mock UI. Nền tảng đã đủ để tiếp tục triển khai theo nghiệp vụ, nhưng chưa nên gọi là hoàn chỉnh hoặc production-ready vì luồng tạo đơn/tồn kho/công nợ chưa atomic, permission matrix chưa enforce, RLS chưa có bằng chứng và chưa có test tự động.

Đánh giá tổng thể: **6.5/10 về sản phẩm pilot**, **6/10 về an toàn vận hành**.

## Những phần đã có thật

| Khu vực | Hiện trạng |
|---|---|
| Đăng nhập | Supabase Auth Google/email, API kiểm tra bearer token và user ACTIVE |
| Vai trò | ADMIN, ACCOUNTANT, SALE, WAREHOUSE; route và API có role gate cơ bản |
| Dashboard | Doanh thu/ngày, đơn hàng, hàng hết kho, công nợ, top sản phẩm từ dữ liệu API |
| POS | Tìm hàng, giỏ hàng, sửa số lượng/giá, khách nhanh, trả một phần, lưu nháp, tạo đơn thật, mở bill |
| Sản phẩm | CRUD, trạng thái vòng đời, giá/quy đổi, cập nhật giá theo sheet và luồng duyệt |
| Kho | Tồn kho, nhập/xuất/kiểm kê, yêu cầu/duyệt kiểm kê, log điều chỉnh |
| Khách hàng | Danh sách, thông tin, sổ nợ, đơn hàng, ghi chú, tạo/sửa và xuất XLSX |
| Tài chính | Tổng quan công nợ, tuổi nợ, phiếu thu, phân bổ vào đơn nợ, cashbook backend |
| Đơn hàng/bill | Nhật ký bán, lọc, chi tiết, in/chia sẻ, xuất XLSX |
| Settings | Branding, QR thanh toán, đơn vị/quy đổi, user/role, import, Sheets sync, readiness, audit, clear history |
| Tích hợp | Supabase, Vercel serverless, Google Sheets sync, XLSX import/export, Vercel cron |
| Bảo mật nền | Bearer auth, service role server-side, security headers, noindex/robots, cron secret, audit log |

## Khoảng trống quan trọng

### P0 - phải xử lý trước khi vận hành nhiều người

1. **Transaction bán hàng**: gom tạo đơn, item, trừ kho, ledger, receipt, cashbook và audit vào một transaction database.
2. **Chống sửa request POS**: server tự đọc giá/trạng thái sản phẩm, validate số lượng, quyền sửa giá, khách/kho và actor từ session.
3. **Chống trùng và tranh chấp**: idempotency key, row lock/conditional update tồn kho, không cho tồn âm ngoài chính sách.
4. **RLS và quyền direct Supabase**: audit live, bật RLS/revoke cho toàn bộ bảng nghiệp vụ, test bằng anon key.
5. **Backup trước xóa lịch sử**: export snapshot có checksum, chỉ xóa khi backup thành công, audit không thể xóa từ UI.
6. **Khóa bootstrap admin**: bỏ cơ chế tự cấp ADMIN cho user đầu tiên khỏi request production thông thường.

### P1 - để app đủ nghiệp vụ hàng ngày

1. **Permission matrix thật**: page/action/scope, admin cấu hình được, backend bắt buộc kiểm tra; không chỉ ẩn nút.
2. **Scope theo nhân viên**: SALE chỉ thấy đơn/khách/nợ được giao; WAREHOUSE theo kho; ACCOUNTANT theo phạm vi được cấp.
3. **Hoàn thiện POS**:
   - Nút/khung chọn sản phẩm trực quan (đã bổ sung trong đợt này).
   - Chọn đơn vị/quy đổi HỘP-VIÊN-M2 khi bán.
   - Cảnh báo tồn, hàng HOLD/DISCONTINUED, hạn mức nợ và nợ quá hạn.
   - TTL/xóa giỏ nháp, barcode scan, phím tắt, khóa double-click thanh toán.
4. **Đổi/trả/hủy đơn**: chứng từ điều chỉnh thay vì sửa/xóa trực tiếp; hoàn tồn, hoàn tiền và ledger đối ứng.
5. **Chốt ca/khoá sổ**: ca bán hàng, đối chiếu tiền mặt/chuyển khoản, khóa ngày, mở khóa có phê duyệt.
6. **Supplier 360 và mua hàng**: schema đã có nhưng UI hiện mới là danh sách vận hành nhỏ; cần đơn mua, nhận hàng, phải trả, phiếu chi, lịch sử giá mua.
7. **Giao hàng**: triển khai role DELIVERY, phiếu xuất có người lập/kho/giao/nhận, trạng thái giao và ký nhận theo `update.md`.
8. **Customer 360 đầy đủ**: receipt, aging theo đơn, timeline, liên hệ, file/ảnh chứng từ, cam kết trả nợ.

### P2 - tăng tốc và khả năng quản trị

1. PWA/offline queue cho POS; cảnh báo xung đột khi đồng bộ lại.
2. Notification rules theo vai trò và SLA; Telegram chỉ triển khai sau permission/audit/idempotency.
3. Báo cáo lợi nhuận, vòng quay kho, hàng chậm bán, dự báo nhập hàng, doanh số theo sale/khách/nhóm hàng.
4. Observability: request ID, structured log, error tracking, cảnh báo cron/sync/API thất bại.
5. Backup/restore diễn tập định kỳ, không chỉ sync sang Google Sheets.
6. Test tự động: unit cho tính tiền/ledger, integration cho order/receipt/RBAC, E2E cho POS mobile/desktop.

## Đánh giá UX

- Mobile đã được xử lý theo card/bottom sheet ở nhiều màn, nhưng các page lớn vẫn dài và chứa logic/UI trong một file 600-1.300 dòng; khó test và dễ hồi quy.
- POS trước đợt này chỉ hiện kết quả khi gõ tìm kiếm, nên người bán không có điểm bấm để duyệt danh mục. Nút `Chọn sản phẩm` và khung danh mục đã giải quyết khoảng trống trực tiếp này.
- App vẫn dùng nhiều `alert`/`confirm`; cần toast, dialog xác nhận và lỗi theo field để không làm gián đoạn ca bán.
- Nên tách service/API hooks, schema validation và component theo module trước khi thêm nhiều tính năng mới.

## Thứ tự triển khai đề xuất

1. Transaction + server validation + idempotency cho order/receipt/inventory.
2. RLS audit/migration + khóa bootstrap admin.
3. Permission matrix và scope dữ liệu.
4. Trả/hủy đơn, chốt ca, khóa sổ, backup-before-clear.
5. Supplier/purchase/payable và delivery/stock-out.
6. PWA/barcode/notification/Telegram.

## Tiêu chí gọi là đủ dùng production nội bộ

- Không thể sửa giá/actor/số lượng/kho bằng request thủ công ngoài quyền.
- Một đơn chỉ commit toàn bộ hoặc rollback toàn bộ; retry không tạo trùng.
- RLS/direct access đã được test trên project production.
- Quyền và scope được enforce ở backend cho từng hành động.
- Có quy trình trả/hủy/điều chỉnh, chốt ca, khóa sổ, backup/restore.
- Test tự động bao phủ POS, phiếu thu, tồn kho, RBAC và các failure path quan trọng.
- Smoke test production pass trên mobile và desktop sau mỗi deploy.
