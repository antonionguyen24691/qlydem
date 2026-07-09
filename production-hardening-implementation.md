# Triển khai hardening vận hành PMQL

## Mục tiêu
Đưa POS, phiếu thu và dữ liệu nghiệp vụ lên nền transaction/RLS/permission có thể vận hành nhiều người an toàn.

## Công việc
- [x] Thêm migration cho RLS, idempotency, archive trước xóa và RPC transaction POS/phiếu thu → Kiểm tra: SQL có rollback/khóa tồn/revoke direct access.
- [x] Chuyển API order/receipt sang RPC, bỏ actor/giá do client quyết định → Kiểm tra: request có giá hoặc actor giả không thay đổi kết quả.
- [x] Khóa bootstrap admin, thêm permission matrix backend + UI và scope đọc dữ liệu theo user → Kiểm tra: role không được cấp bị chặn cả API/UI.
- [x] Làm an toàn import, clear-history và POS draft → Kiểm tra: giới hạn upload, dry-run, backup snapshot, TTL/xóa nháp.
- [x] Bổ sung ADR/runbook, typecheck/build/audit và kiểm tra luồng local → Kiểm tra: mã build được và đường migration/deploy rõ ràng.

## Hoàn tất khi
- [x] Source POS/receipt chuyển sang transaction RPC; cần apply migration để có hiệu lực production.
- [x] Migration khai báo RLS/revoke direct access; probe production được ghi trong runbook, chưa chạy khi chưa deploy.
- [x] Các hardening có tài liệu áp dụng production riêng, không tự giả định đã được deploy.
