# Rà soát app và bổ sung bộ chọn sản phẩm POS

## Mục tiêu
Đối chiếu toàn bộ app với đánh giá bảo mật hiện có, cập nhật tài liệu theo code thật và bổ sung nút mở khung chọn sản phẩm trong POS.

## Công việc
- [x] Rà cấu trúc, route, store, API, schema/migration và tài liệu hiện tại → Kiểm tra: lập danh sách trạng thái thật và khoảng trống.
- [x] Kiểm tra `updatesecurity.md` với auth/RBAC/RLS/import/audit hiện tại → Kiểm tra: mọi nhận định lỗi thời được sửa và việc còn thiếu có bằng chứng file.
- [x] Bổ sung nút và khung chọn sản phẩm cho POS, giữ tìm kiếm/quy đổi tồn kho hiện có → Kiểm tra: chọn sản phẩm từ khung sẽ thêm đúng vào giỏ.
- [x] Cập nhật đánh giá/tính năng đề xuất theo mức P0/P1/P2 → Kiểm tra: tài liệu phân biệt rõ đã có, còn thiếu, cần xác minh production.
- [x] Chạy typecheck, build, audit và kiểm tra diff → Kiểm tra: không có lỗi mới và thay đổi chỉ nằm trong phạm vi yêu cầu.

## Hoàn tất khi
- [x] POS có nút dễ thấy để mở danh sách chọn sản phẩm trên desktop/mobile.
- [x] `updatesecurity.md` phản ánh đúng code hiện tại và không tuyên bố production khi chưa có bằng chứng live.
- [x] Các lệnh kiểm tra dự án đều xanh hoặc nêu rõ blocker thực tế.
