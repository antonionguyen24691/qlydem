# Runbook triển khai hardening PMQL

## Thứ tự bắt buộc

1. Chụp backup off-platform của Supabase trước khi thay đổi schema.
2. Apply `supabase/migrations/20260710_secure_transactions_rls.sql` lên đúng project production.
3. Xác minh service-role vẫn gọi được hai RPC và anon/authenticated không đọc được bảng nghiệp vụ.
4. Deploy API/frontend cùng commit sau migration.
5. Smoke test bằng user ADMIN, ACCOUNTANT, SALE và WAREHOUSE.

## Các probe tối thiểu

- Anonymous `select` vào `customers`, `products`, `sales_orders`, `inventory_balances` phải bị từ chối.
- POS: tạo đơn bằng idempotency key, gửi lại đúng key và xác nhận chỉ có một order/receipt/inventory transaction.
- POS: sửa `unitPrice`, `productName`, `saleId`, `warehouseId` trong request SALE; server phải bỏ qua hoặc từ chối theo quyền.
- POS: bán nhiều hơn tồn; transaction phải rollback hoàn toàn.
- Phiếu thu: gửi `createdBy` của user khác hoặc thu vượt nợ; server phải từ chối/bỏ qua actor giả.
- Clear history: xác nhận có `history_clear_backups.id` trước khi có bản ghi bị xóa.

## Cấu hình thủ công còn lại

- Trong Supabase Auth, bật leaked-password protection và MFA cho ADMIN nếu plan cho phép.
- Dùng `npm run bootstrap:admins` để tạo/quản lý admin đầu tiên; API không còn tự nâng user đăng nhập đầu tiên thành ADMIN.
- Thiết lập backup off-platform định kỳ. `history_clear_backups` chỉ hỗ trợ khôi phục logic sau thao tác xóa nhầm, không thay thế backup thảm họa.

## Update 2.0 — tenant và entitlement

Chỉ thực hiện sau khi các probe hardening bên trên đã đạt:

1. Tạo backup production và restore thử sang môi trường kiểm tra.
2. Apply `supabase/migrations/20260712_update2_entitlements.sql` trước khi deploy API Update 2.0.
3. Xác nhận user hiện có được gắn tenant `default` và tenant này có đúng một license `CLOUD` trạng thái `ACTIVE`.
4. Xác nhận anon/authenticated không đọc trực tiếp được `tenants`, `licenses`, `license_entitlements`, `license_installations`, `usage_counters`.
5. Deploy API/frontend cùng commit chứa migration contract.
6. Gọi `GET /api/settings?key=entitlements` bằng bearer token hợp lệ và xác nhận plan/features đúng.
7. Gọi bằng token thiếu/không hợp lệ và xác nhận trả `401`; API tính năng ngoài gói phải trả `403 FEATURE_NOT_ENTITLED`.

Không bật entitlement API trước migration vì query `users.tenant_id` sẽ chưa tồn tại.
