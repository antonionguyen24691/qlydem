# Update Security Plan - PMQL

Ngay tao: 2026-07-09

Muc tieu cua file nay la gom cac viec bao mat con lai thanh mot checklist co the trien khai dan, khong lam vo app dang chay tren Vercel/Supabase. App hien da co auth API, service role server-side, chan crawler/noindex, cron secret cho Google Sheets sync va mot so header bao mat. Phan can nang cap tiep la RLS Supabase, phan quyen chi tiet, audit thao tac manh, va giam rui ro tu import/export/token.

## 0. Cập nhật đánh giá theo code ngày 2026-07-10

Kết luận mới: **6/10 - phù hợp pilot nội bộ có kiểm soát, chưa đạt production-ready**.

Lý do hạ mức so với đánh giá `7/10` trong `docs/SECURITY_REVIEW.md`:

- Auth và role gate đã có thật, nhưng `permissions_json` mới chỉ được lưu trong bảng `roles`; backend/frontend chưa dùng ma trận quyền này để quyết định thao tác.
- `supabase/schema.sql` chưa có câu lệnh bật RLS hoặc policy cho các bảng nghiệp vụ. Chưa được phép suy luận production đã an toàn nếu chưa chạy audit trực tiếp trên Supabase.
- API tạo đơn đang tin dữ liệu giá, số lượng, kho, `saleId` từ client; API phiếu thu cũng nhận `createdBy` từ client. Đây là rủi ro sửa giá, giả danh actor và làm sai sổ nếu request bị sửa thủ công.
- Tạo đơn, trừ kho, ghi công nợ, phiếu thu và sổ quỹ là chuỗi nhiều lệnh độc lập, chưa nằm trong một transaction database. Lỗi giữa chừng có thể để lại đơn/ledger/tồn kho lệch nhau.
- Luồng trừ kho chưa khóa dòng tồn, chưa chặn tồn âm và chưa có idempotency key; hai lần bấm hoặc hai sale bán đồng thời có thể gây sai tồn.
- `Clear history` hiện đã có chọn nhóm, chữ xác nhận và audit sau xóa, nhưng **chưa tạo backup trước khi xóa**. Nếu backup/audit lỗi sau khi xóa thì dữ liệu đã mất.
- Import đang đọc toàn bộ request vào RAM và ghi thật ngay; chưa giới hạn byte/số dòng, chưa có dry-run, chưa chặn Excel formula injection.
- POS draft chưa có TTL và đang lưu cả thông tin khách đã chọn trong `localStorage`.

### Các lớp bảo vệ đã xác nhận trong code

- API nghiệp vụ chính dùng Supabase bearer token và tra user ACTIVE trong bảng `users`.
- Các thao tác admin/user/settings/import/finance/kho đã có role gate cơ bản ở backend.
- Service role chỉ được dùng ở server API; frontend chỉ khởi tạo Supabase bằng anon key cho Auth.
- Có audit log cho nhiều thao tác tạo/sửa/duyệt quan trọng.
- Có CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, robots/noindex và cron secret.
- Có màn kiểm tra bảng production, notification, lịch sử audit và trạng thái vận hành.

### P0 bổ sung - khóa tính toàn vẹn giao dịch POS/tài chính

Việc phải làm trước khi mở rộng người dùng:

1. Backend bỏ qua `saleId`, `createdBy` do client gửi; actor luôn lấy từ session đã xác thực. Chỉ admin có endpoint riêng để gán lại người phụ trách và phải ghi audit.
2. Backend tải sản phẩm từ database theo `productId`, kiểm tra trạng thái bán, số lượng dương, giá hợp lệ và quyền sửa giá. Không dùng tên/giá client làm nguồn sự thật.
3. Chuyển tạo đơn + item + tồn kho + công nợ + phiếu thu + sổ quỹ + audit vào một PostgreSQL function/RPC transaction.
4. Khóa dòng tồn (`for update`) hoặc dùng phép cập nhật có điều kiện; chặn tồn âm theo cấu hình và trả lỗi rõ sản phẩm nào thiếu.
5. Thêm `idempotency_key` unique cho tạo đơn và phiếu thu để retry/double click không tạo chứng từ trùng.
6. Validate hạn mức nợ, khách bị khóa, kỳ đã khóa sổ, phương thức thanh toán và tổng phân bổ phiếu thu.

Kiem thu bat buoc:

- Gửi request sửa `unitPrice`, số lượng âm, `saleId`/`createdBy` của người khác: server phải từ chối hoặc bỏ qua field giả mạo.
- Gửi cùng một `idempotency_key` hai lần: chỉ có một đơn/phiếu thu.
- Hai request bán cùng sản phẩm đồng thời: tồn không âm và chỉ request đủ tồn thành công.
- Cố tình làm lỗi ở bước ghi ledger: toàn bộ transaction rollback, không có đơn mồ côi.

### P0 bổ sung - khóa bootstrap admin

`requireAuth` hiện tự tạo ADMIN cho người đăng nhập đầu tiên khi bảng `users` rỗng. Cơ chế này tiện khi khởi tạo nhưng nguy hiểm nếu production bị reset/trỏ nhầm database.

Huong lam:

- Bỏ auto-bootstrap khỏi request thông thường sau khi đã vận hành.
- Dùng script bootstrap một lần với email allowlist/secret triển khai.
- Ghi audit và fail-closed nếu bảng `users` rỗng trên production.

### P1 bổ sung - scope dữ liệu và endpoint cấu hình

- SALE hiện có thể đọc toàn bộ khách hàng, đơn hàng và `order_debts` theo role; chưa giới hạn `sale_id`/khách được giao. Cần triển khai `scope.own`, `scope.department`, `scope.all` ở backend query.
- GET `/api/settings` hiện không yêu cầu đăng nhập cho `branding`, `payment`, `units`, `inventoryOperations`. Nên tách `branding` public; các key vận hành/thanh toán yêu cầu auth hoặc chỉ trả subset thật sự cần cho bill.
- API role GET cho mọi user ACTIVE xem được toàn bộ role definition. Chỉ trả dữ liệu tối thiểu cần cho UI hoặc giới hạn admin.

### Trạng thái từng nhóm trong kế hoạch cũ

| Nhóm | Trạng thái code 2026-07-10 | Kết luận |
|---|---|---|
| RLS | Chưa thấy enable/policy trong schema/migration | P0, phải audit live rồi thêm migration |
| Permission matrix | Có bảng roles và `permissions_json`, UI mới gán role | P1, chưa enforce |
| MFA/leaked password | Chỉ có tài liệu thao tác dashboard | Chưa xác minh live |
| Import an toàn | Có template, required columns, batch/error log | Thiếu limit, dry-run, formula guard |
| Clear history | Có ADMIN gate, chọn nhóm, chữ XOA, audit | Thiếu backup-before-delete và transaction |
| POS draft | Có lưu/khôi phục/xóa sau checkout | Thiếu TTL và nút xóa riêng |
| Secret/CSP/noindex | Có nền tảng code và docs | Cần verify production/rotate theo vận hành |

Phần kế hoạch bên dưới vẫn giữ làm backlog chi tiết; khi mâu thuẫn, kết luận cập nhật ngày 2026-07-10 ở trên là nguồn ưu tiên mới.

## 0.1. Đợt triển khai local ngày 2026-07-10

Đã bổ sung trong source, **chưa tự apply lên Supabase/Vercel production**:

- Migration `20260710_secure_transactions_rls.sql`: RLS/revoke direct access cho bảng nghiệp vụ, idempotency keys, archive trước clear history, RPC transaction cho tạo đơn và phiếu thu.
- API POS/phiếu thu: actor lấy từ bearer session, không dùng `saleId`/`createdBy`/tên hàng/giá do client gửi; RPC tự đọc catalog, khóa tồn và kiểm tra hạn mức nợ.
- Idempotency key bắt buộc cho tạo đơn/phiếu thu; POS tạo key một lần cho lần checkout và dùng lại khi retry.
- Auto-bootstrap ADMIN trong request đã bị gỡ. Dùng script `bootstrap:admins` để provision user đầu tiên.
- Permission matrix có màn cấu hình ở Settings, được backend đọc; scope `department` hiện fail-closed về `own` vì chưa có mô hình phòng ban.
- Import có giới hạn 10 MB/5.000 dòng, dry-run trước khi ghi thật và neutralize text bắt đầu bằng công thức Excel.
- Clear history tạo archive logic trước khi xóa; archive này không thay thế backup off-platform.
- POS draft tự hết hạn sau 24 giờ và có nút xóa nháp.

Điều kiện release: apply migration trước, rồi deploy code; chạy `npm run verify:hardening`, test POS/receipt/RLS theo `docs/SECURE_DEPLOY_RUNBOOK.md`.

## 1. Uu tien cao

### 1.1 Audit va bat RLS Supabase

Van de:
- Chua co block ro rang trong schema/migration ve `enable row level security` cho toan bo bang nghiep vu.
- App dang bao ve chu yeu bang API server va `SUPABASE_SERVICE_ROLE_KEY`.
- Neu bang public chua bat RLS va anon/authenticated co quyen doc/ghi truc tiep thi co rui ro lo du lieu.

Huong lam:
- Tao file audit `docs/SUPABASE_RLS_AUDIT.md`.
- Liet ke tat ca bang public trong production.
- Phan nhom bang:
  - Bang nghiep vu can khoa chat: products, customers, sales_orders, order_items, debts, receipts, inventory, stock_movements, settings, audit logs, users.
  - Bang public neu co: gan nhu khong nen co trong app noi bo.
  - Bang he thong/migration: chi doc noi bo.
- Kiem tra tung bang:
  - RLS da bat hay chua.
  - Policy nao dang cho `anon` hoac `authenticated`.
  - Direct Supabase client tu frontend co dang truy cap table nao khong.
- Them migration rieng:
  - `alter table public.<table> enable row level security;`
  - revoke quyen table truc tiep tu `anon`, `authenticated` neu app chi di qua API server.
  - Neu can policy, viet policy toi thieu theo role/data scope, khong dung policy rong.

Nguyen tac:
- Service role API server van duoc phep lam viec noi bo.
- Frontend khong duoc doc/ghi truc tiep bang nghiep vu bang anon key.
- Auth user chi di qua API route co `requireAuth` va `requireRole/requirePermission`.

Kiem thu:
- Dung anon key thu select cac bang nghiep vu: phai fail.
- Login user binh thuong, goi API app: phai van chay.
- Kiem tra POS, don hang, khach hang, cong no, ton kho, cai dat sau khi bat RLS.

### 1.2 Ma tran phan quyen chi tiet

Van de:
- Role hien tai con coarse-grained theo endpoint/page.
- Chua co man admin cau hinh ro user nao duoc xem subpage nao, thao tac gi, export/import/xoa/duyet den dau.

Can thiet ke permission keys:
- Page/subpage:
  - `page.dashboard.view`
  - `page.pos.view`
  - `page.orders.view`
  - `page.products.view`
  - `page.inventory.view`
  - `page.customers.view`
  - `page.finance.view`
  - `page.settings.view`
  - `page.approvals.view`
- Action:
  - `order.create`
  - `order.update`
  - `order.export.pdf`
  - `order.export.xlsx`
  - `order.share.image`
  - `inventory.receive`
  - `inventory.issue`
  - `inventory.audit`
  - `price.edit`
  - `price.approve`
  - `customer.create`
  - `customer.update`
  - `finance.receipt.create`
  - `finance.debt.writeoff`
  - `data.import`
  - `data.export`
  - `history.clear`
  - `settings.update`
  - `users.manage`
- Scope:
  - `scope.own`
  - `scope.department`
  - `scope.all`

Huong lam:
- Tao bang hoac settings JSON cho role permissions.
- Backend them helper `requirePermission(permissionKey)`.
- Frontend them helper `can(permissionKey)` de an/hien menu, tab, nut.
- Man admin trong Settings:
  - Tab "Phan quyen".
  - Danh sach role.
  - Checkbox theo page/action.
  - Gan quyen rieng cho user neu can override.
- Tat ca API nhay cam bat buoc check permission backend, khong chi an nut tren UI.

Kiem thu:
- SALE khong thay finance neu khong co quyen.
- KE_TOAN duoc lap phieu thu, nhung sua gia ban hang lo phai gui duyet neu chua co `price.approve`.
- KHO duoc nhap/xuat/kiem ke theo quyen.
- ADMIN thay toan bo, duyet duoc, xoa duoc khi co audit.

### 1.3 MFA va leaked password protection

Van de:
- Supabase Auth Advisor bao `Leaked Password Protection Disabled`.
- Admin/ke toan/kho la tai khoan nhay cam.

Viec lam thu cong tren Supabase:
- Authentication -> Attack Protection.
- Dong `Prevent use of leaked passwords` dang disabled.
- Neu dashboard bat buoc `Configure in email provider` hoac yeu cau Pro plan, ghi lai trang thai vao `docs/SECURITY_REVIEW.md`.
- Authentication -> Multi-Factor: bat MFA cho ADMIN truoc, sau do ke toan/kho neu phu hop.
- Rate Limits: giu gioi han dang nhap/recovery/OTP o muc chat.

Luu y:
- Neu goi Free khong cho bat leaked password protection thi coi day la accepted risk tam thoi, nhung buoc doi mat khau manh va MFA cho admin.

## 2. Uu tien trung binh

### 2.1 Import Excel an toan hon

Rui ro:
- File qua lon lam cham app/API.
- So dong qua nhieu lam qua tai.
- Cong thuc Excel doc hai hoac noi dung hong.
- Du lieu import sai kieu tao loi ke toan/kho.

Huong lam:
- Gioi han file size, vi du 5-10 MB tuy nhu cau.
- Gioi han so dong import moi lan, vi du 2.000-5.000 dong.
- Chan cell bat dau bang `=`, `+`, `-`, `@` khi export/import text de tranh formula injection.
- Validate bat buoc cac cot:
  - product code, ten hang, don vi tinh, gia von, gia ban, quy doi.
  - khach hang, SDT, dia chi.
  - chung tu, ngay, so tien, trang thai cong no.
- Co preview/import dry-run truoc khi ghi that.
- Ghi audit log moi lan import: ai import, file ten gi, so dong, loi, ngay gio.

Kiem thu:
- Import file dung: thanh cong.
- Import file qua lon: bi tu choi ro ly do.
- Import co formula: bi chan hoac sanitize.
- Import sai cot: bao loi theo dong/cot.

### 2.2 Clear history phai co backup va audit bat buoc

Rui ro:
- `Clear history` la quyen rat manh.
- Xoa don hang, lich su mua ban, xuat kho, cong no co the lam mat bang chung ke toan.

Huong lam:
- Chi ADMIN co `history.clear`.
- Truoc khi xoa, tao backup JSON/XLSX noi bo cho tap du lieu se xoa.
- Yeu cau confirm 2 lop:
  - chon loai lich su can xoa.
  - nhap chu xac nhan, vi du `XOA LIC SU`.
- Ghi audit log bat buoc:
  - user id, email, role.
  - loai du lieu xoa.
  - so ban ghi.
  - time range.
  - backup file/ref.
  - thoi gian xoa.
- Khong cho xoa audit log bang UI thong thuong.

Kiem thu:
- User khong co quyen khong thay nut.
- ADMIN xoa co audit va backup.
- Neu backup fail thi khong duoc xoa.

### 2.3 POS localStorage draft

Rui ro:
- Gio hang tam luu tren may co the con lai qua lau.
- Khong nen luu thong tin nhay cam.

Huong lam:
- Them TTL cho POS draft, vi du 12-24 gio.
- Khi checkout thanh cong thi xoa draft.
- Khong luu token, thong tin rieng tu nhay cam vao draft.
- Co nut "Xoa gio tam" neu can.

Kiem thu:
- Refresh trang van giu gio trong TTL.
- Qua TTL thi gio tu reset.
- Ban hang thanh cong khong con draft cu.

### 2.4 Token/secret hygiene

Rui ro:
- Vercel token, Supabase service key, Google Sheets credential neu bi dan vao chat/log thi phai coi la lo.

Huong lam:
- Rotate cac token tung bi dan vao chat.
- Chi luu secret trong Vercel Environment Variables/Supabase secret store.
- Khong commit `.env.local`.
- Them checklist release:
  - `git grep` khong co token.
  - Vercel env du.
  - Supabase service key chi server-side.

Kiem thu:
- `git grep -n "vcp_"` khong ra token.
- `git grep -n "SUPABASE_SERVICE_ROLE"` chi thay env name, khong thay gia tri that.

### 2.5 CSP va third-party allowlist

Rui ro:
- Sau nay them Telegram bot, bank QR, map, anh ngoai, webhook se can domain moi.
- Neu mo CSP qua rong thi tang rui ro XSS/data exfiltration.

Huong lam:
- Giu CSP hien tai chat.
- Moi tich hop moi phai ghi domain vao danh sach allowlist.
- Khong dung `*` neu khong bat buoc.
- Neu can anh QR/bank/logo ngoai, chi allow domain cu the.

Kiem thu:
- App chay khong bi CSP block o console.
- Domain la danh sach co chu dich, khong mo rong vo dieu kien.

## 3. Uu tien thap nhung nen giu

### 3.1 Robots/noindex

Trang thai:
- Da co `robots.txt`, meta noindex, `X-Robots-Tag`.
- Day chi la lop chan crawler hop phap, khong phai bao mat du lieu tuyet doi.

Can giu:
- Khong xoa cac header noindex.
- Vercel cron van giu.
- Cron du lieu chi cho Vercel goi bang `CRON_SECRET`, user ngoai khong goi duoc.

Kiem thu:
- `/robots.txt` tra ve disallow.
- Route app co `X-Robots-Tag`.
- API cron khong co secret tra `401`.

### 3.2 Google Sheets sync

Rui ro:
- Du lieu day sang ben thu ba.
- Sync theo giao dich lam cham POS/in don.

Huong lam:
- Giu cron theo lich, vi du 11:30, 18:00, 24:00 neu Vercel plan cho phep.
- Giu nut admin sync thu cong.
- Khong sync dong bo theo tung giao dich POS neu lam cham app.
- Log moi lan sync: ai bam, may dong, thanh cong/that bai.

Kiem thu:
- Ban hang/in bill khong doi Google Sheets.
- Cron/manual sync chay rieng va co log.

## 4. Thu tu trien khai de it rui ro

### Phase 1 - Audit khong pha app

- Tao `docs/SUPABASE_RLS_AUDIT.md`.
- Tao script/probe kiem tra RLS bang anon key neu co env.
- Xac nhan frontend khong doc/ghi direct Supabase table.
- Cap nhat `docs/SECURITY_REVIEW.md` voi ket qua thuc te.

Exit criteria:
- Biet ro bang nao chua bat RLS.
- Biet ro bang nao co policy/quyen direct nguy hiem.
- Chua thay doi production data.

### Phase 2 - Khoa RLS bang migration

- Them migration bat RLS/revoke quyen direct.
- Chay local lint/build.
- Apply migration len production Supabase bang quy trinh co backup.
- Smoke test app tren production.

Exit criteria:
- Anon key khong doc duoc bang nghiep vu.
- App dang nhap va API van hoat dong.
- POS/order/customer/finance/inventory/settings van dung.

### Phase 3 - Permission matrix

- Thiet ke bang/settings permissions.
- Them backend `requirePermission`.
- Them frontend `can`.
- Settings co man "Phan quyen".
- Giai doan dau map role mac dinh:
  - ADMIN: all.
  - KE_TOAN: finance, receipts, debt, view orders, export, price edit request.
  - KHO: inventory receive/issue/audit, view product.
  - SALE: POS, customer, orders cua minh hoac all tuy cau hinh.
  - DELIVERY: xem phieu xuat/giao hang neu sau nay kich hoat.

Exit criteria:
- Role khong co quyen bi chan ca UI lan API.
- Admin doi quyen va thay doi co hieu luc.

### Phase 4 - Giam rui ro van hanh

- Import Excel limit/preview/sanitize.
- Clear history backup + audit mandatory.
- POS draft TTL.
- Secret rotation checklist.
- CSP allowlist process.

Exit criteria:
- Test cac case fail an toan.
- Khong con popup/loi he thong gay mat luong ban hang.

### Phase 5 - Verify va deploy

- Chay:
  - `npm run lint`
  - `npm run build`
  - `npm audit`
- Kiem production:
  - `/robots.txt`
  - app routes co security headers.
  - API cron ngoai khong secret tra `401`.
  - login/POS/order/bill/customer debt/inventory/settings.
- Commit va push len `main`.
- Theo doi Vercel deployment den khi live.

## 5. Viec can lam thu cong

Supabase:
- Bat leaked password protection neu plan cho phep.
- Bat MFA cho admin.
- Rotate service role key neu tung bi lo.
- Apply RLS migration sau khi backup.
- Kiem tra SQL Advisor lai.

Vercel:
- Rotate Vercel token tung dan vao chat.
- Kiem tra Environment Variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
  - Google Sheets secrets neu co.
- Kiem tra Cron Jobs van con bat.

GitHub:
- Dam bao `.env.local` khong commit.
- Neu token da tung vao commit/log thi rotate ngay.

## 6. Dinh nghia xong

Bao mat duoc coi la dat muc "production-ready noi bo" khi:
- Tat ca bang nghiep vu bat RLS hoac duoc khoa direct access ro rang.
- API server la duong ghi/doc chinh cho du lieu nghiep vu.
- Role/permission co ma tran ro va enforced tren backend.
- Admin actions manh co audit va backup.
- Import/export co gioi han va sanitize.
- Secret da rotate neu tung lo.
- Cron noi bo van chay, nguoi ngoai khong goi duoc.
- Production smoke test xanh sau deploy.
