# Finance Integrity Hardening

## Goal
Khép kín các luồng doanh thu, giá vốn, công nợ khách/NCC, kho, quỹ và quyền bằng các giao dịch server-side có thể kiểm chứng.

## Tasks
- [x] Thêm contract test cho migration/API tài chính mới → Verify: test thất bại trước khi triển khai và đạt sau khi hoàn tất.
- [x] Thêm migration lưu giá vốn lúc bán, điều chỉnh nợ khách, trả nợ NCC, hủy đơn và kiểm kê atomic → Verify: SQL contract đạt; remote probe đang chờ áp migration.
- [x] Chuyển API khách hàng/kho sang RPC, thêm endpoint trả NCC và hủy đơn → Verify: các mutation tiền/kho chính đi qua RPC.
- [x] Nối UI tài chính/NCC/đơn hàng với nghiệp vụ mới → Verify: typecheck và build đạt.
- [x] Thống nhất chỉ số thực thu/chi và sử dụng permission động → Verify: cùng bộ lọc nguồn tiền và route guard permission-aware.
- [x] Chạy lint, build, audit, hardening checks và đối chiếu production sau migration → Verify: tất cả kiểm tra đạt, bất biến dữ liệu không lệch.

## Done When
- [x] Không thể sửa trực tiếp số nợ; thanh toán NCC và hủy đơn có bút toán đối ứng; giá vốn lịch sử không đổi; kho/tiền/nợ ghi atomic.
