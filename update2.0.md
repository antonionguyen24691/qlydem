# PMQL Update 2.0 — Kế hoạch nâng cấp sản phẩm

Ngày lập: 12/07/2026  
Nguồn tổng hợp: code hiện tại, migration Supabase, `ROADMAP.md`, `update.md`, `updatesecurity.md`, `pricing.md` và các quyết định trong cuộc trao đổi định giá lifetime.

## 1. Mục tiêu

PMQL 2.0 nâng bản pilot bán hàng hiện tại thành một sản phẩm có thể đóng gói theo năm nhóm khách hàng:

1. Phổ thông: bán hàng, kho, công nợ và báo cáo cơ bản.
2. Thông minh: thêm chatbot và quét hóa đơn/chứng từ trực tuyến.
3. Local Offline: có chatbot tra cứu nội bộ, quét hóa đơn tại máy và không phụ thuộc Internet cho nghiệp vụ chính.
4. Database Cloud: dữ liệu tập trung, phân quyền, backup, chatbot và quét hóa đơn tiết kiệm chi phí.
5. Mobile Business: toàn bộ gói Cloud cộng ứng dụng Android/iPhone, camera quét chứng từ và thông báo.

Update 2.0 không thay thế các kiểm soát tiền, kho và công nợ hiện có. Chatbot và kết quả quét chỉ được tạo **bản nháp**; người có quyền phải kiểm tra và xác nhận trước khi hệ thống gọi transaction RPC để ghi dữ liệu thật.

## 2. Trạng thái thực tế trước Update 2.0

### Đã có trong source

- React 19 + Vite + Tailwind CSS + Zustand.
- Supabase Auth, user ACTIVE, role và permission scope.
- POS, đơn hàng, bill, sản phẩm, khách hàng, nhà cung cấp, tồn kho, công nợ, thu/chi và dashboard.
- API Vercel serverless, Supabase PostgreSQL, đồng bộ Google Sheets, import/export XLSX.
- Migration transaction bảo mật cho tạo đơn, phiếu thu, nhập/xuất/kiểm kho, trả nhà cung cấp, điều chỉnh nợ và hủy đơn.
- Idempotency, khóa tồn, RLS/revoke direct access, audit log, backup logic trước xóa lịch sử và permission matrix.
- Notification table, trang Settings, readiness và các script kiểm tra hardening/tài chính.

### Có thiết kế nhưng chưa triển khai hoàn chỉnh

- Role `DELIVERY`, phiếu xuất kho có người giao/người nhận và ký nhận.
- Telegram Ops Bot và Telegram Customer Bot.
- PWA/offline queue, push notification, camera barcode và ứng dụng native.
- Chatbot nghiệp vụ thật có tool calling và giới hạn dữ liệu theo quyền.
- Quét hóa đơn/chứng từ, màn hình kiểm tra kết quả và luồng ghi dữ liệu.
- Bản cài local có database, dịch vụ quét và backup/restore hoàn chỉnh.
- License/entitlement theo gói lifetime.

### Lưu ý production

Migration và source hardening đã tồn tại nhưng không được suy luận là production đã áp dụng đầy đủ. Trước Update 2.0 phải chạy runbook, migration và probe trên đúng project Supabase/Vercel đang bán cho khách.

## 3. Nguyên tắc sản phẩm

- Gói cao hơn luôn bao gồm toàn bộ chức năng gói thấp hơn.
- Từ gói Thông minh trở lên đều có chatbot.
- Không hiển thị tên nhà cung cấp/model quét trong giao diện hoặc tài liệu bán hàng; chỉ dùng ngôn ngữ “quét hóa đơn”, “trích xuất chứng từ”, “xử lý tại máy” và “xử lý trực tuyến”.
- Tên công nghệ chỉ xuất hiện trong tài liệu kỹ thuật nội bộ và cấu hình admin.
- Chatbot không được truy cập database trực tiếp; mọi dữ liệu đi qua API/tool có auth, permission và audit.
- Kết quả quét không tự tạo đơn, nhập kho, ghi thu/chi hoặc công nợ.
- Mỗi tài liệu phải có trạng thái, nguồn, checksum, người duyệt và lịch sử sửa.
- Không cam kết độ chính xác 100%; tiền, số lượng, đơn giá, mã hàng, thuế và đối tác luôn cần xác nhận.
- Local Offline không gửi ảnh chứng từ lên cloud nếu khách chưa bật chế độ hỗ trợ trực tuyến.
- License lifetime là quyền dùng phiên bản đã bàn giao; server, API, store và dịch vụ bên thứ ba không phải lifetime.

## 4. Ma trận tính năng theo gói

| Nhóm tính năng | Phổ thông | Thông minh | Local Offline | Database Cloud | Mobile Business |
|---|---:|---:|---:|---:|---:|
| POS, kho, công nợ, báo cáo | Có | Có | Có | Có | Có |
| Chatbot nghiệp vụ | Không | Có | Có | Có | Có |
| Quét hóa đơn/chứng từ | Không | Trực tuyến | Tại máy | Kết hợp tiết kiệm | Kết hợp + camera |
| Database tập trung | Tùy triển khai | Tùy triển khai | Tại văn phòng | Cloud | Cloud |
| Làm việc khi mất Internet | Nháp giới hạn | Nháp giới hạn | Nghiệp vụ chính | Hàng đợi giới hạn | Hàng đợi mobile |
| Nhiều chi nhánh | Không mặc định | Không mặc định | Tùy mạng nội bộ | Có | Có |
| Android/iPhone native | Không | Không | Không | PWA | Có |
| Giao hàng/ký nhận | Add-on | Add-on | Add-on | Add-on | Tối ưu nhất |
| Telegram Bot | Add-on | Add-on | Ops nội bộ tùy mạng | Có thể bật | Có thể bật |

Feature flag phải được kiểm tra ở cả UI và backend. Không chỉ ẩn nút ở frontend.

## 5. Kiến trúc quét hóa đơn và chứng từ

### 5.1 Loại tài liệu ưu tiên

1. Phiếu nhập hàng và hóa đơn mua hàng.
2. Phiếu xuất kho/giao hàng.
3. Hóa đơn bán hàng và bảng kê.
4. Phiếu thu, phiếu chi và biên nhận chuyển khoản.
5. Danh mục/bảng giá nhà cung cấp.

Giai đoạn đầu chỉ tự động tạo bản nháp phiếu nhập và danh sách dòng hàng. Các loại chứng từ ảnh hưởng trực tiếp tiền/công nợ được mở sau khi luồng kiểm tra ổn định.

### 5.2 Pipeline chung

1. Người dùng chụp ảnh, tải ảnh hoặc PDF.
2. Server kiểm tra loại file, kích thước, virus/malware, checksum và chống upload trùng.
3. Tiền xử lý: xoay ảnh, cắt viền, tăng tương phản và tách trang.
4. Bộ xử lý tại máy/server đọc trước đối với chứng từ rõ và biểu mẫu quen thuộc.
5. Bản online có thể chuyển trang khó sang dịch vụ xử lý nâng cao.
6. Chuẩn hóa kết quả về schema chung: đối tác, ngày, số chứng từ, dòng hàng, số lượng, đơn giá, thuế và tổng tiền.
7. Chạy rule kiểm tra: tổng dòng = tổng hóa đơn, mã hàng tồn tại, số lượng/giá hợp lệ, trùng chứng từ và sai lệch thuế.
8. Hiển thị màn hình đối chiếu ảnh bên trái, dữ liệu trích xuất bên phải.
9. Người có quyền sửa/xác nhận.
10. Backend gọi RPC bảo mật với idempotency key để tạo dữ liệu thật.

### 5.3 Engine kỹ thuật nội bộ

- Online: ưu tiên Mistral OCR cho tài liệu/bảng và chi phí theo trang thấp; giữ adapter để đổi nhà cung cấp mà không sửa UI.
- Local: PP-OCRv5 cho chứng từ thông thường; PaddleOCR-VL chỉ dùng cho tài liệu khó và máy đủ cấu hình.
- Không hard-code tên model trong domain. Dùng interface `DocumentExtractionProvider` và cấu hình provider theo deployment.
- Có circuit breaker, timeout, retry giới hạn và fallback về kiểm tra thủ công.

### 5.4 Trạng thái tài liệu

`UPLOADED` → `PROCESSING` → `NEEDS_REVIEW` → `APPROVED` → `COMMITTED`

Nhánh lỗi:

- `FAILED`: lỗi xử lý, cho phép retry có kiểm soát.
- `REJECTED`: người dùng từ chối kết quả.
- `DUPLICATE`: checksum hoặc số chứng từ đã tồn tại.
- `EXPIRED`: file nháp quá thời hạn lưu giữ.

## 6. Chatbot nghiệp vụ

### 6.1 Phạm vi

- Tra cứu sản phẩm, tồn kho, giá bán, khách hàng, đơn hàng và công nợ theo quyền.
- Tóm tắt doanh thu, dòng tiền, tồn kho thấp và nợ đến hạn.
- Hướng dẫn thao tác trong app.
- Mở nhanh màn hình/đối tượng liên quan.
- Tạo **yêu cầu/bản nháp** như nhắc nợ, phiếu giao hoặc dự thảo đơn; không tự duyệt giao dịch.
- Giải thích kết quả quét hóa đơn và chỉ ra trường thiếu/sai lệch.

### 6.2 Chatbot theo môi trường

- Thông minh/Cloud/Mobile: chatbot server-side, có thể dùng model online và tool calling.
- Local Offline: intent/rule engine và truy vấn nội bộ là lớp mặc định; local model là tùy chọn theo cấu hình máy.
- Khi offline, chatbot chỉ trả lời từ dữ liệu đã đồng bộ tại máy và phải hiển thị thời điểm dữ liệu gần nhất.

### 6.3 Guardrail bắt buộc

- Tool nào cũng nhận actor từ session, không nhận actor/role do chatbot tự khai báo.
- Permission scope `own/department/all` áp dụng giống màn hình app.
- Không trả giá vốn/lợi nhuận cho role không được phép.
- Không hiển thị công nợ khách khác cho sale hoặc customer bot.
- Prompt injection trong nội dung hóa đơn/tệp không được phép thay đổi system instruction hay gọi tool.
- Tool thay đổi dữ liệu phải trả về draft/approval request, không commit trực tiếp.
- Lưu audit cho câu hỏi nhạy cảm, tool call, kết quả và người xác nhận; hỗ trợ xóa/ẩn nội dung theo chính sách dữ liệu.

## 7. Local Offline

### Kiến trúc đề xuất

- Giữ UI React/Vite hiện tại.
- Đóng gói desktop Windows cùng local API service, PostgreSQL local và worker xử lý chứng từ.
- Dùng cùng domain schema và transaction contract với bản cloud để tránh tách thành hai sản phẩm khác nhau.
- Có installer, migration runner, health check, backup scheduler và restore wizard.
- Mạng LAN là tùy chọn cho tối đa số máy trạm theo license; máy chủ local là nguồn sự thật.

### Đồng bộ

- Mặc định local-only: không gửi dữ liệu ra ngoài.
- Nếu khách bật đồng bộ cloud: dùng outbox/inbox có idempotency, version và conflict log.
- Không dùng “last write wins” cho tiền, kho và công nợ; xung đột phải tạo yêu cầu đối soát.
- Backup tối thiểu hằng ngày sang ổ đĩa thứ hai; backup ngoài địa điểm là tùy chọn nhưng được khuyến nghị.

### Điều kiện cấu hình

- Chạy bộ 100 chứng từ thật trước khi nghiệm thu tính năng quét.
- Ghi cấu hình máy đã nghiệm thu vào license installation.
- Nâng cấp phần cứng, driver hoặc hệ điều hành nằm ngoài bảo hành phần mềm nếu không thuộc cấu hình đã chốt.

## 8. Database Cloud

- Supabase PostgreSQL là nguồn dữ liệu giao dịch chính.
- Vercel API chỉ là lớp HTTP; transaction tiền/kho/nợ tiếp tục nằm trong PostgreSQL RPC.
- File chứng từ lưu object storage theo đường dẫn private, signed URL ngắn hạn và retention policy.
- Quét chứng từ dùng chiến lược xử lý nhẹ trước, chỉ chuyển trang khó sang dịch vụ nâng cao.
- Có quota theo tenant/tháng, usage ledger, cảnh báo 80%/100% và chặn mềm khi vượt hạn mức.
- Dữ liệu nhiều doanh nghiệp phải có `tenant_id` hoặc tách project/database; không dựa chỉ vào filter frontend.
- Backup Google Sheets chỉ phục vụ theo dõi/đối soát, không thay thế backup PostgreSQL và object storage.

## 9. Mobile Business

- Dùng Capacitor để tái sử dụng React/Vite và tạo Android/iOS shell; đánh giá lại nếu plugin native không đáp ứng.
- App mở thẳng màn hình sử dụng sau đăng nhập, không đưa landing/pricing vào native bundle.
- Luồng mobile ưu tiên: POS nhanh, tra tồn, công nợ, quét hóa đơn, giao hàng, ký nhận và dashboard gọn.
- Camera có căn khung, crop, xoay, nén và kiểm tra độ rõ trước khi upload.
- Offline queue mã hóa tại thiết bị; không lưu service key hoặc dữ liệu nhạy cảm trong localStorage thường.
- Push notification theo role; nội dung notification không để lộ công nợ/tiền trên màn hình khóa nếu chưa được phép.
- Android bàn giao APK/AAB; iOS bàn giao build/TestFlight/IPA theo tài khoản Apple của khách.

## 10. Giao hàng và Telegram

### Giao hàng

- Thêm role `DELIVERY` và permission chỉ xem/cập nhật phiếu được giao.
- Phiếu xuất kho lưu snapshot kế toán, thủ kho, người giao và người nhận.
- Trạng thái: nháp, chờ soạn, đã xuất, đã gán giao, đang giao, giao thành công, giao một phần, thất bại và hủy.
- Ảnh/chữ ký giao hàng là chứng từ đính kèm; không cho DELIVERY sửa giá, công nợ hoặc tồn kho.
- Mỗi chuyển trạng thái ghi log, vị trí chỉ lưu khi nhân viên chủ động đồng ý/chia sẻ.

### Telegram

- Ops Bot cho admin, kế toán, sale, kho và giao hàng.
- Customer Bot cho khách tra đơn, công nợ, thông tin thanh toán và gửi yêu cầu đặt hàng.
- Hai bot tách token, webhook, bảng account/session/message và permission.
- Telegram chỉ triển khai sau khi delivery, permission, audit và idempotency đã ổn định.
- Lệnh thay đổi dữ liệu tạo yêu cầu chờ duyệt; không ghi trực tiếp từ tin nhắn.

## 11. Schema mới đề xuất

### License và tenant

- `tenants`: doanh nghiệp, trạng thái, timezone và cấu hình dữ liệu.
- `licenses`: gói, ngày kích hoạt, quyền lifetime, thời hạn bảo hành và trạng thái.
- `license_entitlements`: feature key, limit và hiệu lực.
- `license_installations`: thiết bị/server, fingerprint, phiên bản và lần kiểm tra gần nhất.
- `usage_counters`: tenant, loại quota, kỳ, số đã dùng và số giữ chỗ.

### Quét chứng từ

- `document_jobs`: tenant, loại chứng từ, nguồn, provider nội bộ, trạng thái, confidence và lỗi.
- `document_files`: storage key, mime, size, checksum, page count và retention.
- `document_extractions`: dữ liệu header chuẩn hóa, raw payload mã hóa và phiên bản schema.
- `document_line_items`: dòng hàng trích xuất, mapping sản phẩm và confidence từng trường.
- `document_reviews`: before/after, reviewer, quyết định, ghi chú và thời gian.
- `document_commits`: entity type/id, idempotency key và kết quả RPC.
- `document_templates`: mapping biểu mẫu theo nhà cung cấp/khách hàng.

### Chatbot

- `assistant_conversations`: tenant, user, channel, thời điểm và retention.
- `assistant_messages`: role, nội dung đã lọc, token/usage và error.
- `assistant_tool_calls`: tool, input đã che dữ liệu, permission decision, output và trạng thái duyệt.
- `assistant_feedback`: đánh giá, lý do và câu trả lời sửa.

### Giao hàng/Telegram

- Dùng `stock_deliveries`, `stock_delivery_logs`, `delivery_attachments`.
- Dùng `telegram_accounts`, `telegram_groups`, `telegram_sessions`, `telegram_messages`, `telegram_command_logs`, `telegram_notification_rules`.

Tất cả bảng mới phải có `tenant_id`, `created_at`, actor/audit phù hợp, RLS và index theo query thực tế.

## 12. API mới đề xuất

### Document

- `POST /api/documents/upload`
- `POST /api/documents/:id/process`
- `GET /api/documents/:id`
- `PATCH /api/documents/:id/review`
- `POST /api/documents/:id/approve`
- `POST /api/documents/:id/commit`
- `POST /api/documents/:id/retry`
- `DELETE /api/documents/:id`

### Chatbot

- `POST /api/assistant/message`
- `GET /api/assistant/conversations`
- `GET /api/assistant/conversations/:id`
- `POST /api/assistant/tool-calls/:id/approve`
- `POST /api/assistant/feedback`

### License/local/mobile

- `GET /api/settings?key=entitlements`
- `POST /api/licenses/activate`
- `POST /api/licenses/heartbeat`
- `GET /api/usage`
- `POST /api/sync/push`
- `POST /api/sync/pull`

Các endpoint commit phải lấy actor từ bearer session, kiểm tra entitlement + permission, yêu cầu idempotency key và gọi RPC transaction.

## 13. Permission mới

- `assistant.use`
- `assistant.view_finance`
- `assistant.create_draft`
- `documents.scan`
- `documents.view`
- `documents.review`
- `documents.commit_inventory`
- `documents.commit_finance`
- `documents.manage_templates`
- `delivery.view`
- `delivery.assign`
- `delivery.update_status`
- `delivery.sign`
- `telegram.manage`
- `licenses.manage`
- `usage.view`

Mặc định SALE chỉ đọc dữ liệu `own`; DELIVERY chỉ đọc phiếu được gán; customer bot chỉ đọc đúng `customer_id` đã liên kết.

## 14. Bảo mật và dữ liệu

- File upload dùng allowlist MIME, magic-byte verification, giới hạn dung lượng/số trang và malware scan.
- File private, signed URL ngắn hạn, mã hóa khi lưu và có retention/xóa theo tenant.
- Không log ảnh, token, full prompt hoặc raw dữ liệu tài chính vào log ứng dụng.
- Secret provider chỉ nằm ở server; local secret lưu trong Windows Credential Manager hoặc vault tương đương.
- Rate limit theo tenant/user/device; quota reservation trước khi gọi dịch vụ tính phí.
- Chống prompt injection từ nội dung tài liệu; tài liệu luôn là dữ liệu không đáng tin, không phải instruction.
- Có consent khi dùng xử lý trực tuyến và cờ `local_only` không thể bị provider adapter bỏ qua.
- License check không được làm mất quyền truy cập dữ liệu khi bảo hành/phí duy trì hết hạn; chỉ tắt dịch vụ vận hành tương ứng.

## 15. UI/UX cần bổ sung

- Trung tâm chứng từ: danh sách upload, trạng thái, lỗi, người duyệt và entity đã tạo.
- Màn hình review hai cột; trên mobile chuyển thành ảnh trên, form dưới.
- Highlight trường confidence thấp và sai lệch tổng tiền.
- Nút “Lưu nháp”, “Xác nhận tạo phiếu”, “Từ chối” và “Xử lý lại”.
- Chatbot dạng panel, có nguồn dữ liệu, thời điểm cập nhật và nút mở màn hình liên quan.
- Chatbot phải nói rõ khi không đủ quyền/không đủ dữ liệu; không bịa số liệu.
- Settings có: gói hiện tại, entitlement, quota, mức dùng, chế độ local-only, retention và kiểm tra kết nối.
- Giao diện bán hàng chỉ dùng tên tính năng tiếng Việt; không lộ tên engine/model/provider.

## 16. Lộ trình triển khai

### Phase 0 — Chốt baseline production

- Apply đúng migration hardening/finance lên môi trường mục tiêu.
- Chạy `npm run verify:hardening` và `npm run verify:finance-integrity:remote`.
- Xác nhận RLS, RPC, auth dashboard và backup trước khi thêm module mới.

### Phase 1 — Tenant, license và entitlement

- Thêm schema tenant/license/entitlement/usage.
- Tạo middleware kiểm tra feature + permission ở backend.
- Thêm Settings hiển thị gói/quota nhưng không khóa dữ liệu khi maintenance hết hạn.

### Phase 2 — Quét chứng từ MVP

- Làm upload, storage private, job state, extraction schema và review UI.
- Chỉ hỗ trợ phiếu nhập/hóa đơn mua trước.
- Commit qua RPC nhập kho bảo mật sau khi người dùng duyệt.

### Phase 3 — Chatbot an toàn

- Làm tool read-only cho sản phẩm, tồn kho, khách, đơn và công nợ.
- Enforce permission scope và audit tool call.
- Sau khi read-only ổn định mới mở draft/approval action.

### Phase 4 — Local Offline

- Đóng gói local API/database/worker, installer, migration và backup/restore.
- Làm quét tại máy, chatbot nội bộ và health check.
- Kiểm thử mất mạng, restart, hỏng job và restore backup.

### Phase 5 — Cloud hybrid và quota

- Thêm provider adapter, fallback tài liệu khó, usage reservation và billing report.
- Thêm retention, circuit breaker, cảnh báo quota và cost dashboard.

### Phase 6 — Delivery và Telegram

- Triển khai role DELIVERY, phiếu giao, ký nhận và log trạng thái.
- Làm Ops Bot read-only trước; Customer Bot và lệnh tạo yêu cầu sau.

### Phase 7 — Mobile Business

- Đóng gói Capacitor Android/iOS, camera document capture, offline queue và push.
- Kiểm thử thiết bị thật, quyền camera, mất mạng, background/resume và nâng phiên bản.

### Phase 8 — Verification và phát hành

- Unit test parser/normalizer/rule/quota/permission.
- Integration test upload → review → RPC commit và rollback failure.
- E2E desktop/mobile cho quét hóa đơn, chatbot, POS, delivery và license.
- Load/cost test theo tenant; diễn tập backup/restore; smoke test production sau deploy.

## 17. Tiêu chí nghiệm thu

- Bộ tối thiểu 100 chứng từ thật, có ảnh rõ, nghiêng, mờ và nhiều biểu mẫu.
- Ít nhất 95% trường quan trọng đúng trên bộ chứng từ chuẩn; trường confidence thấp được đánh dấu.
- Tổng tiền/dòng hàng sai không thể commit nếu chưa được sửa.
- Upload trùng không tạo hai chứng từ; retry không tạo hai phiếu.
- Chatbot không đọc được dữ liệu ngoài scope và không commit giao dịch trực tiếp.
- Local Offline tiếp tục bán hàng, tra cứu và quét chứng từ khi mất Internet.
- Sync lại không làm âm tồn, trùng đơn hoặc lệch công nợ.
- Gói cao hơn thực sự có toàn bộ entitlement gói thấp hơn.
- Hết phí duy trì không làm mất license hoặc dữ liệu đã bàn giao.
- Typecheck, build, security verification, finance verification và smoke test đều đạt.

## 18. Các quyết định cần giữ cố định

- Gói khuyên bán: Database Cloud.
- Bốn gói từ Thông minh trở lên đều có chatbot.
- Local Offline có quét hóa đơn không tính theo trang, nhưng hiệu năng phụ thuộc cấu hình nghiệm thu.
- Online/cloud/mobile dùng xử lý nhẹ trước và dịch vụ nâng cao cho chứng từ khó để kiểm soát chi phí.
- Tên công nghệ không xuất hiện trong bảng giá hoặc giao diện khách hàng.
- AI/chatbot/quét hóa đơn không được trở thành đường tắt vượt qua auth, permission, audit hoặc transaction RPC.

## 19. Definition of Done cho Update 2.0

- [ ] Baseline production hardening được xác minh trên môi trường thật.
- [ ] Entitlement backend hoạt động cho đủ năm gói.
- [ ] Quét phiếu nhập có review và commit atomic.
- [ ] Chatbot read-only đúng permission và có audit.
- [ ] Bản Local Offline cài đặt, backup/restore và chạy mất mạng.
- [ ] Database Cloud có quota/cost/retention và fallback an toàn.
- [ ] Delivery/Telegram không vượt quyền và không tạo giao dịch trùng.
- [ ] Mobile Android/iOS vượt test camera, offline queue và store build.
- [ ] Tài liệu vận hành, bảo hành, privacy và support được bàn giao.
- [ ] Verification cuối cùng đạt trên desktop, mobile, local và production cloud.
