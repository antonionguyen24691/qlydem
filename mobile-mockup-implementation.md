# Triển khai mobile mockup thành UI thật

## Goal
Chuyển toàn bộ thiết kế Moss/Terracotta trong `PMQL-mobile*.dc.html` thành giao diện React responsive thật, giữ nguyên nghiệp vụ và desktop hiện tại.

## Tasks
- [x] Đối chiếu mockup với các route/component hiện có và khóa phạm vi hai theme.
- [x] Tạo mechanics mobile dùng chung và hai lớp art-direction Moss/Terracotta độc lập.
- [x] Viết lại POS mobile theo catalog-first với checkout composition riêng cho từng theme.
- [x] Áp grammar mockup cho Dashboard, Orders, Finance và các màn chi tiết.
- [x] Áp Moss card rows và Terracotta flat rows cho Products, Inventory, Customers, Suppliers, Settings và Login.
- [x] Đồng bộ drawer, dialog dùng chung và form mobile với token/typography đúng theme.
- [x] Chạy typecheck, 12 unit tests, build, PWA/contract và browser smoke ở 390×844.
- [ ] Commit, push và xác minh Vercel production sau khi full verification đạt.

## Done When
- [x] Moss/Terracotta có presentation marker và art-direction riêng, không còn chỉ đổi màu.
- [x] Typecheck, unit test và production build xác nhận không mất contract nghiệp vụ hiện có.
- [x] Browser smoke 390×844 xác nhận Login không tràn ngang; POS giữ safe-area và navigation escape bằng contract.

## Notes
- Classic giữ bố cục hiện tại.
- Moss giữ card grammar, dark green POS dock/drawer và accent vàng đồng.
- Terracotta dùng editorial/flat grammar, white POS dock, payment pill, CTA cam, font Instrument Sans/Space Grotesk và drawer trắng.
- Browser local không có phiên đăng nhập nên visual smoke sau-auth được bù bằng DOM/CSS contract, render marker, typecheck, tests và build; production asset/routes được kiểm tra sau deploy.
- `.claude/`, `.codex-remote-attachments/` và `theme new/` không được commit.
