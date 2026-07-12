# PWA cài đặt PMQL trên Android và iPhone

Ngày cập nhật: 12/07/2026

## Mục tiêu

Cho phép người dùng mở PMQL trên trình duyệt và cài ra màn hình chính như một ứng dụng trên Android, iPhone và iPad.

Lưu ý thương mại:

- Đây là PWA, không phải APK/AAB Android hoặc IPA iOS.
- Android có thể hiện nút cài trực tiếp khi trình duyệt hỗ trợ.
- iPhone/iPad cài qua Safari bằng nút Chia sẻ rồi chọn Thêm vào Màn hình chính.
- PWA production cần chạy qua HTTPS; localhost chỉ dùng để kiểm thử kỹ thuật.
- Bản hiện tại ưu tiên cài app shell và dùng online. Chưa bật offline queue cho đơn hàng, công nợ, kho hoặc chứng từ.

## Tính năng đã có

- Manifest ứng dụng: tên, màu chủ đạo, biểu tượng, shortcut POS/kho/tài chính.
- Icon Android/iOS: 64, 192, 512, maskable và Apple touch icon.
- Service worker tạo bởi Vite PWA.
- Không cache API giao dịch để tránh dùng dữ liệu tiền/kho/nợ cũ.
- Prompt cài đặt trong app:
  - Android/Chrome/Edge: hiện nút Cài ứng dụng khi trình duyệt phát sự kiện cài.
  - iPhone/iPad/Safari: hiện hướng dẫn thao tác Chia sẻ -> Thêm vào Màn hình chính.
  - Khi đã cài hoặc chạy ở standalone mode thì không hiện lại.

## Cách kiểm thử local

```powershell
npm run typecheck
npm test
npm run build
npm run verify:pwa
npm run preview -- --host 127.0.0.1 --port 4181
```

Mở:

- `http://127.0.0.1:4181/manifest.webmanifest`
- `http://127.0.0.1:4181/sw.js`
- `http://127.0.0.1:4181/login`

Kết quả mong đợi:

- Manifest trả về 200 và có `display: standalone`.
- Service worker trả về 200.
- Trang login có theme color, Apple mobile web app capable và link manifest.
- Trên trình duyệt hỗ trợ, app có thể cài ra màn hình chính.

## Checklist thiết bị thật

Android:

- Mở production HTTPS bằng Chrome.
- Đăng nhập thử.
- Kiểm tra nút Cài ứng dụng hoặc menu Cài đặt ứng dụng.
- Cài ra màn hình chính.
- Mở lại từ icon, xác nhận app chạy dạng standalone.

iPhone/iPad:

- Mở production HTTPS bằng Safari.
- Chọn Chia sẻ.
- Chọn Thêm vào Màn hình chính.
- Mở lại từ icon, xác nhận không còn thanh địa chỉ Safari.
- Kiểm tra đăng nhập, chuyển trang POS/kho/tài chính.

## Giới hạn cần ghi rõ khi bán

- PWA giúp khách dùng nhanh trên điện thoại mà chưa cần store.
- Không thay thế gói Mobile Business native nếu cần camera nâng cao, push notification ổn định, secure storage native hoặc offline queue mã hóa.
- Các giao dịch quan trọng vẫn cần mạng ở giai đoạn này.

