# Moss/Terracotta Mobile Parity Design

## Mục tiêu

Hoàn thiện giao diện responsive/PWA theo đúng bộ mockup trong `theme new/Nâng cấp giao diện ứng dụng`, để Moss và Terracotta có ngôn ngữ trình bày riêng thay vì dùng một layout rồi chỉ đổi token màu. Toàn bộ dữ liệu, phân quyền, hành vi POS, thanh toán, tồn kho và API hiện có phải được giữ nguyên.

## Nguồn thiết kế chuẩn

- Moss desktop: `PMQL-A.dc.html`, `PMQL-A-pages.dc.html`, `PMQL-A-dialogs.dc.html`, `PMQL-moss-sidebar.dc.html`.
- Terracotta desktop: `PMQL-B.dc.html`, `PMQL-B-pages.dc.html`, `PMQL-B-dialogs.dc.html`, `PMQL-terra-nav.dc.html`.
- Mobile/PWA: `PMQL-mobile.dc.html`, `PMQL-mobile-2.dc.html`, `PMQL-mobile-3.dc.html`.
- Theme metadata/token: `design_handoff_theme_system`.

Khi mockup và README handoff khác mức chi tiết, mockup màn hình cụ thể được ưu tiên cho presentation; README quyết định phần nào được dùng chung về kiến trúc và nghiệp vụ.

## Phạm vi màn hình

1. Dashboard.
2. POS và checkout dock.
3. Tài chính.
4. Đơn hàng và chi tiết đơn hàng.
5. Sản phẩm.
6. Tồn kho.
7. Khách hàng và chi tiết khách hàng.
8. Nhà cung cấp.
9. Chi phí, hóa đơn và các biểu mẫu mobile trong mockup.
10. Đăng nhập, Cấu hình giao diện, drawer và bottom navigation.

Desktop tiếp tục dùng sidebar tối cho Moss và top navigation cho Terracotta. Classic không thay đổi.

## Kiến trúc trình bày

### Phần dùng chung

- Store, hooks, API calls, phân quyền, lọc/tìm kiếm, tính tiền và mutation giữ nguyên.
- Các dialog mà `PMQL-B-dialogs.dc.html` ghi rõ dùng cùng Moss tiếp tục dùng chung DOM; theme chỉ thay token, font, radius, border và button treatment.
- Component nghiệp vụ không được sao chép thành hai implementation độc lập.

### Phần tách theo theme

- Mỗi trang có một root modifier xác định `moss` hoặc `terracotta`.
- Những màn có composition khác rõ ràng sẽ có presentation component riêng, nhận cùng view-model/handler từ trang cha.
- POS tách thành `MossMobilePOS` và `TerracottaMobilePOS`, cùng nhận catalog, cart và checkout actions.
- Các trang còn lại ưu tiên semantic class + CSS variant riêng; chỉ tách JSX khi thứ tự nội dung hoặc hierarchy khác mockup.
- CSS mobile không dùng selector chung để áp một card/table grammar cho cả hai theme. Rule chung chỉ chứa reset, safe-area, touch target và behavior không mang art direction.

## Khác biệt bắt buộc

### Moss

- Geist, nền xám kem, card bo vừa, sidebar/drawer và POS dock xanh rêu đậm.
- Accent vàng đồng cho trạng thái chính và CTA POS.
- Dashboard thiên về card vận hành; bảng/list mobile giữ card rows.
- Bottom navigation nền xanh đậm theo mockup.

### Terracotta

- Instrument Sans cho body, Space Grotesk cho heading/số liệu quan trọng.
- Nền giấy kraft, ink nâu đậm, primary cam đất.
- Dashboard dùng hierarchy editorial: KPI dạng dải chia cột, separator rõ, giảm box-in-box.
- POS dùng dock trắng, tổng tiền cam, payment pill, CTA cam và card có mã/tồn kho.
- Danh sách/bảng ưu tiên row phẳng và divider, ít shadow/card hơn Moss.
- Bottom navigation và drawer nền trắng; desktop giữ top navigation.

## Responsive và khả dụng

- Breakpoint mobile hiện tại `<1024px` được giữ để đồng bộ layout app.
- Mọi nút thao tác chính có vùng chạm tối thiểu 44px; các target độc lập cạnh nhau cách ít nhất 8px. Segmented control được phép liền cạnh vì toàn bộ control có border phân vùng rõ ràng.
- Tôn trọng `safe-area-inset-top` và `safe-area-inset-bottom`.
- POS luôn có đường thoát rõ ràng tới drawer điều hướng.
- Checkout dock không che sản phẩm cuối, dialog hoặc bàn phím nhập liệu.
- Không dựa vào hover hay gesture-only interaction.

## Tương thích chức năng

- Không thay đổi schema/API hoặc logic tiền, công nợ, tồn kho.
- Không đổi route, permission gate, PWA registration hoặc cache policy.
- Các trạng thái loading, empty, unavailable, selected và disabled phải còn hoạt động ở cả hai theme.
- Classic và desktop phải qua regression test sau khi chỉnh mobile.

## Kiểm thử và tiêu chí chấp nhận

1. Contract test xác nhận mỗi theme có marker/presentation riêng cho các màn được tách.
2. TypeScript, unit test, PWA verification và production build đều đạt.
3. Kiểm tra ở tối thiểu 390x844, 430x932, tablet nhỏ và desktop.
4. So sánh trực quan các màn đại diện với mockup: Dashboard, POS, Finance, Orders, Products, Customers, Login, Settings và drawer.
5. POS của Terracotta không còn sử dụng dark Moss checkout dock; POS Moss vẫn giữ dark dock.
6. Kiểm tra drawer mở/đóng, bottom navigation, search/filter, add-to-cart, quantity, payment selector và checkout validation.
7. Sau deploy, production `/pos` và các route chính trả HTTP 200; bundle live chứa marker của cả hai presentation.

## Phát hành

- Chỉ stage file thuộc implementation và test; giữ nguyên các file local/untracked của người dùng.
- Commit implementation sau khi toàn bộ kiểm tra đạt.
- Push cùng commit lên nhánh phát hành và `main`.
- Chờ Vercel production `READY`, xác nhận alias `qlydem.vercel.app` và asset live trước khi báo hoàn tất.

## Ngoài phạm vi

- Không thiết kế lại nghiệp vụ hoặc thêm tính năng mới không có trong app/mockup.
- Không sao chép dữ liệu giả từ mockup vào production.
- Không sửa các migration Supabase hay quyền truy cập.
- Không thay Classic thành một trong hai theme mới.
