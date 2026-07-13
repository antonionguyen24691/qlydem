# Triển khai mobile mockup thành UI thật

## Goal
Chuyển toàn bộ thiết kế Moss/Terracotta trong `PMQL-mobile*.dc.html` thành giao diện React responsive thật, giữ nguyên nghiệp vụ và desktop hiện tại.

## Tasks
- [x] Đối chiếu mockup với các route/component hiện có và khóa phạm vi hai theme.
- [ ] Tạo primitives mobile dùng chung: page shell, header, section/card/list, bottom navigation và theme variants.
- [ ] Viết lại POS mobile theo catalog-first, cart dock và checkout sheet của mockup.
- [ ] Áp bố cục mockup cho Dashboard, Orders, Finance và các màn chi tiết.
- [ ] Áp bố cục mockup cho Products, Inventory, Customers, Suppliers, Settings và Login.
- [ ] Đồng bộ drawer, modal và form mobile trong `PMQL-mobile-3.dc.html` với luồng thật.
- [ ] Chạy typecheck, test, build, PWA contract và kiểm tra responsive 360/394/430px cho cả Moss/Terracotta.
- [ ] Commit toàn bộ thay đổi sau khi mọi kiểm tra đạt.

## Done When
- [ ] Mobile production dùng đúng cấu trúc và ngôn ngữ hình ảnh của mockup, không chỉ đổi màu.
- [ ] Không mất chức năng POS, công nợ, kho, thanh toán, quyền truy cập hoặc desktop layout.
- [ ] Không còn lỗi overflow/chồng bottom bar trên các route chính.

## Notes
- Classic giữ bố cục hiện tại.
- Moss và Terracotta có variant mobile riêng.
- `.claude/`, `.codex-remote-attachments/` và `theme new/` không được commit.
