# Roadmap triển khai PMQL Update 2.0

Ngày lập: 12/07/2026  
Tài liệu nguồn: `update2.0.md`  
Phạm vi: đánh giá khả năng nâng cấp và chuyển thiết kế Update 2.0 thành kế hoạch thực thi.

## Trạng thái triển khai

Cập nhật ngày 12/07/2026:

- R0 automated baseline: đạt hardening, finance local/remote, typecheck, build và audit; còn backup restore/RLS/Auth dashboard cần xác nhận thủ công.
- R1 test foundation: đang triển khai; đã thêm Vitest, 8 test entitlement/guard, test nhận diện PWA và lazy-load page theo route. Bundle chính giảm từ khoảng 544 kB xuống khoảng 237 kB.
- R2 tenant/license/entitlement: đang triển khai trên source; đã có migration nền, feature contract, backend guard, endpoint read-only và contract verifier. Chưa apply production.
- R8 PWA installable: đã ưu tiên triển khai trước native; Android/iPhone có manifest, icon, service worker, hướng dẫn cài và verifier local. Chưa deploy/test thiết bị production.
- R3–R9: chưa bắt đầu.

## 1. Đánh giá Update 2.0

### Điểm tổng quan

| Hạng mục | Điểm | Nhận định |
|---|---:|---|
| Hướng sản phẩm | 8.5/10 | Năm gói rõ, gói cao kế thừa gói thấp, Database Cloud phù hợp làm gói chủ lực |
| Nền giao dịch | 8/10 | RPC, idempotency, RLS, audit và finance hardening đã có nền tốt trong source |
| Kiến trúc chatbot/quét chứng từ | 7.5/10 | Luồng draft → review → commit đúng; cần adapter, quota và bộ dữ liệu nghiệm thu |
| Sẵn sàng multi-tenant/license | 3/10 | Chưa có tenant/entitlement/usage schema và middleware backend |
| Sẵn sàng Local Offline | 2/10 | Chưa có installer, local database, worker, backup/restore và sync conflict |
| Sẵn sàng Mobile native | 2/10 | Chưa có Capacitor, project Android/iOS, secure storage và offline queue |
| Test/observability | 3/10 | Có script hardening nhưng chưa có test pyramid đầy đủ cho module mới |
| Khả năng triển khai ngay | 5/10 | Có thể bắt đầu Cloud MVP; chưa nên làm đồng thời Cloud, Local và Mobile |

### Kết luận

Update 2.0 khả thi nếu giữ một modular monolith, một schema nghiệp vụ và một transaction contract. Không tách năm codebase theo năm gói. Khác biệt gói được điều khiển bằng entitlement ở backend và UI.

Thứ tự thương mại hóa:

1. Database Cloud MVP.
2. Gói Thông minh dùng cùng nền Cloud nhưng giới hạn entitlement/quota.
3. Local Offline sau khi luồng chứng từ và chatbot đã ổn định.
4. PWA installable làm trước để khách dùng nhanh trên Android/iPhone qua trình duyệt.
5. Mobile Business native sau khi API/offline contract ổn định.
6. Delivery/Telegram triển khai song song có kiểm soát sau permission/approval.

## 2. Giả định lập kế hoạch

- Đội hình chuẩn: 01 full-stack chính, 01 người hỗ trợ mobile/desktop/ML bán thời gian.
- Quy mô ban đầu: dưới 100 doanh nghiệp, 5–30 user/doanh nghiệp, tải giao dịch vừa phải.
- Database Cloud tiếp tục dùng Supabase PostgreSQL; Vercel API là lớp HTTP.
- Local ưu tiên Windows và mạng LAN; mobile gồm Android trước, iOS sau.
- Thời lượng là ước lượng kỹ thuật, chưa gồm thời gian chờ Apple/Google duyệt app hoặc mua/cấu hình hạ tầng của khách.
- Nếu chỉ có một lập trình viên, không mở quá hai workstream đồng thời.

Ước lượng:

- Một người thực hiện tuần tự: 20–28 tuần.
- Nhóm 2–3 người có thể chạy song song: 12–18 tuần.
- Bản Cloud MVP có thể đạt điểm bán thử sau khoảng 7–10 tuần nếu baseline production đã ổn.

## 3. Quyết định kiến trúc

### ADR-U2-01 — Modular monolith, không dùng microservices sớm

- Chọn: giữ React/Vite + Vercel API + PostgreSQL RPC; chia module theo feature.
- Không chọn: tách chatbot, billing, document và delivery thành service độc lập ngay.
- Lý do: quy mô/team chưa cần independent scaling; microservices làm tăng deploy, auth, tracing và chi phí lifetime support.
- Revisit khi: worker xử lý chứng từ vượt tải API, trên 100 tenant hoạt động hoặc cần scale độc lập.

### ADR-U2-02 — Một transaction contract cho Cloud và Local

- Chọn: nghiệp vụ tiền/kho/nợ luôn đi qua contract/RPC tương đương.
- Không chọn: viết business logic riêng trong desktop app.
- Lý do: tránh sai lệch số liệu và giảm gấp đôi chi phí bảo trì.
- Revisit khi: local database không đáp ứng PostgreSQL hoặc cần thiết bị edge đặc thù.

### ADR-U2-03 — Quét chứng từ tạo draft, không tự commit

- Chọn: upload → extract → validate → review → RPC commit.
- Không chọn: ảnh hóa đơn tự động tạo phiếu thật.
- Lý do: sai mã hàng/số lượng/đơn giá có thể làm lệch tồn, tiền và công nợ.
- Revisit khi: bộ dữ liệu thật đạt độ chính xác ổn định và vẫn phải giữ approval cho trường tài chính.

### ADR-U2-04 — Chatbot chỉ gọi tool có permission

- Chọn: server-side tool registry, actor từ session, read-only trước.
- Không chọn: chatbot tạo SQL hoặc truy cập Supabase trực tiếp.
- Lý do: giữ RBAC/scope/audit đồng nhất với app.
- Revisit khi: có policy engine độc lập và test red-team đạt.

### ADR-U2-05 — Entitlement backend là nguồn sự thật

- Chọn: backend kiểm tra feature/limit, frontend chỉ phản chiếu.
- Không chọn: chỉ ẩn menu/nút theo gói.
- Lý do: tránh khách gọi API trực tiếp để dùng tính năng chưa mua.
- Revisit khi: chuyển sang nền billing/license bên thứ ba.

## 4. Critical path

```text
Baseline production
  → Test foundation + modular hóa
  → Tenant/license/entitlement
  → Document Center + review
  → Chatbot read-only
  → Cloud quota/fallback
  → Cloud MVP release
  → PWA installable
  → Local Offline
  → Delivery/Telegram
  → Mobile Business
  → Release verification
```

Không bắt đầu Local hoặc Mobile trước khi API document/chatbot và entitlement ổn định.

## 5. Roadmap thực thi

## R0 — Khóa baseline production

Mục tiêu: chứng minh nền giao dịch hiện tại an toàn trên đúng môi trường production trước khi thêm module.

### Công việc

- [ ] Đối chiếu migration local với Supabase production; ghi bảng migration đã apply.
- [ ] Chạy `npm run verify:hardening` và `npm run verify:finance-integrity:remote` bằng tài khoản test.
- [ ] Probe tạo đơn, phiếu thu, nhập kho, trả NCC, hủy đơn, kiểm kê và rollback lỗi.
- [ ] Kiểm tra RLS bằng anon/user token; service role chỉ có ở server.
- [ ] Kiểm tra backup/restore thật, không chỉ Google Sheets sync.
- [ ] Xác minh MFA/leaked-password protection và admin bootstrap thủ công.

### File/tài liệu tác động

- `docs/SECURE_DEPLOY_RUNBOOK.md`
- `docs/OPERATIONS.md`
- `updatesecurity.md`
- `scripts/verify-security-hardening.mjs`
- `scripts/verify-finance-integrity-remote.mjs`

### Gate R0

- Tất cả probe transaction/RLS đạt.
- Backup được restore sang môi trường kiểm tra.
- Không còn bước migration production chưa xác định trạng thái.

Ước lượng: 3–5 ngày.

## R1 — Test foundation và modular hóa

Mục tiêu: giảm nguy cơ hồi quy trước khi thêm ba module lớn.

### Công việc

- [x] Thêm Vitest và test nền entitlement/backend guard; tiếp tục bổ sung tiền, quota, permission và document rules theo từng release.
- [ ] Thêm Playwright cho login, POS, tạo đơn, phiếu thu và role gate.
- [x] Lazy-load các page theo route để giảm bundle khởi động và giữ mỗi module thành chunk riêng.
- [ ] Tách API client/hook khỏi các page lớn; giữ hành vi hiện tại.
- [ ] Tạo feature folders: `src/features/documents`, `assistant`, `entitlements`, `delivery`.
- [ ] Chuẩn hóa error envelope, request ID và audit metadata cho API mới.
- [ ] Thêm structured logging và error tracking không chứa dữ liệu nhạy cảm.

### File dự kiến

- `src/features/*`
- `src/lib/apiClient.ts`
- `api/_lib/errors.ts`
- `api/_lib/requestContext.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/unit/*`
- `tests/e2e/*`

### Gate R1

- `npm run typecheck`, `npm run build`, unit và E2E smoke đạt.
- POS/finance không thay đổi kết quả trước và sau refactor.
- Log có request ID nhưng không có token/raw document.

Ước lượng: 1–2 tuần.

## R2 — Tenant, license và entitlement

Mục tiêu: khóa đúng chức năng của năm gói ở backend.

### Công việc

- [ ] Tạo `tenants`, `licenses`, `license_entitlements`, `license_installations`, `usage_counters`.
- [ ] Gắn `tenant_id` vào user và các bảng cần cô lập; lập migration/backfill cho dữ liệu hiện tại.
- [ ] Thêm RLS/index/unique key theo tenant.
- [ ] Viết `requireEntitlement(feature)` và `reserveUsage(kind, amount)`.
- [ ] Tạo endpoint entitlement trong API hiện có, `GET /api/usage`, activate/heartbeat license.
- [ ] Thêm Settings hiển thị gói, bảo hành, hạn mức và trạng thái dịch vụ.
- [ ] Bảo đảm hết maintenance chỉ tắt dịch vụ vận hành, không khóa dữ liệu/license lifetime.

### Migration/API dự kiến

- `supabase/migrations/*_update2_tenants_entitlements.sql`
- `api/_lib/tenant.ts`
- `api/_lib/entitlements.ts`
- `api/settings/index.ts?key=entitlements`
- `api/usage/index.ts`
- `api/licenses/activate.ts`
- `api/licenses/heartbeat.ts`

### Gate R2

- User tenant A không đọc/ghi tenant B bằng UI, API hoặc anon key.
- Gói thấp gọi API tính năng cao trả `403 FEATURE_NOT_ENTITLED`.
- Hạn mức được giữ chỗ/hoàn lại đúng khi job thất bại.

Ước lượng: 1–2 tuần.

## R3 — Document Center và quét phiếu nhập MVP

Mục tiêu: từ ảnh/PDF tạo bản nháp phiếu nhập có người kiểm tra.

### Công việc

- [ ] Tạo schema job/file/extraction/line/review/commit/template.
- [ ] Tạo bucket private, signed URL, checksum, MIME/magic-byte check và retention.
- [ ] Xây upload → processing → review → approved → committed state machine.
- [ ] Tạo provider interface và mock provider để test không tốn phí.
- [ ] Chuẩn hóa dữ liệu đối tác, số chứng từ, ngày, dòng hàng, thuế và tổng tiền.
- [ ] Mapping mã hàng; cảnh báo mã không tồn tại, trùng hóa đơn và lệch tổng.
- [ ] Làm review UI hai cột desktop, ảnh trên/form dưới mobile.
- [ ] Commit qua `create_inventory_receipt_secure` với idempotency key.

### File dự kiến

- `supabase/migrations/*_update2_documents.sql`
- `api/documents/upload.ts`
- `api/documents/[id]/index.ts`
- `api/documents/[id]/process.ts`
- `api/documents/[id]/review.ts`
- `api/documents/[id]/commit.ts`
- `api/_lib/documents/*`
- `src/features/documents/*`
- `src/pages/Documents.tsx`

### Gate R3

- Upload trùng không tạo hai job.
- Sai tổng/mã hàng không commit được.
- Retry cùng idempotency key chỉ tạo một phiếu nhập.
- 100 chứng từ mẫu đạt mục tiêu trường quan trọng; trường thấp confidence được đánh dấu.

Ước lượng: 2–3 tuần.

## R4 — Chatbot read-only an toàn

Mục tiêu: chatbot trả số liệu đúng quyền, chưa tạo giao dịch thật.

### Công việc

- [ ] Tạo schema conversation/message/tool-call/feedback và retention.
- [ ] Tạo tool registry read-only: sản phẩm, tồn, khách, đơn, nợ, dashboard.
- [ ] Áp dụng permission scope cho từng tool; actor chỉ lấy từ session.
- [ ] Chống prompt injection từ chứng từ và nội dung database.
- [ ] Hiển thị nguồn, thời điểm dữ liệu và nút mở entity liên quan.
- [ ] Tạo panel chatbot responsive và trạng thái không đủ quyền/không đủ dữ liệu.
- [ ] Thêm rate limit, usage logging, redaction và cost limit.
- [ ] Chỉ sau gate read-only mới mở tool tạo draft/approval request.

### File dự kiến

- `supabase/migrations/*_update2_assistant.sql`
- `api/assistant/message.ts`
- `api/assistant/conversations/*`
- `api/assistant/tool-calls/[id]/approve.ts`
- `api/_lib/assistant/tools/*`
- `src/features/assistant/*`

### Gate R4

- SALE không hỏi được nợ/đơn ngoài scope.
- Role không có finance không nhận giá vốn/lợi nhuận.
- Prompt trong file không thể gọi tool hoặc đổi instruction.
- Chatbot không có tool commit order/receipt/inventory.

Ước lượng: 2 tuần.

## R5 — Cloud processing, quota và phát hành Cloud MVP

Mục tiêu: hoàn thiện gói Thông minh/Database Cloud có kiểm soát chi phí.

### Công việc

- [ ] Kết nối provider online qua adapter; không lộ provider ra UI khách hàng.
- [ ] Xử lý nhẹ trước, chỉ gửi trang khó sang dịch vụ nâng cao.
- [ ] Thêm timeout, circuit breaker, retry, fallback thủ công và cost log.
- [ ] Áp quota 500/1.000 trang theo entitlement; cảnh báo 80%/100%.
- [ ] Thêm consent, local-only flag, retention và xóa file.
- [ ] Dashboard admin hiển thị usage/cost/error theo tenant.
- [ ] Pilot với 2–3 khách, thu bộ chứng từ thật và đo correction rate.

### Gate R5

- Không vượt quota khi concurrent request.
- Provider lỗi không làm mất file/job hoặc trừ quota sai.
- Cost/job và correction rate quan sát được.
- Cloud MVP vượt smoke test và có rollback/runbook.

Ước lượng: 1–2 tuần.  
Mốc thương mại: có thể bắt đầu bán thử gói Thông minh và Database Cloud.

## R6 — Local Offline

Mục tiêu: bản Windows local dùng được khi mất Internet và không tách business logic.

### Công việc

- [ ] Chọn/đóng gói desktop shell, local API service, PostgreSQL và document worker.
- [ ] Tạo installer/uninstaller, health check, migration runner và log bundle.
- [ ] Làm chatbot nội bộ rule/query trước; local model là tùy chọn phần cứng.
- [ ] Làm quét chứng từ tại máy, không gửi cloud khi `local_only=true`.
- [ ] Thêm backup scheduler, restore wizard và kiểm tra checksum.
- [ ] Nếu bật sync: dùng outbox/inbox, version và conflict review.
- [ ] Chặn last-write-wins cho tiền/kho/nợ.
- [ ] Gắn device fingerprint và cấu hình máy vào license installation.

### Cấu trúc dự kiến

- `desktop/`
- `services/local-api/`
- `services/document-worker/`
- `scripts/local-installer/`
- `src/features/local-admin/*`

### Gate R6

- Mất Internet vẫn bán hàng, tra cứu, quét và in bill.
- Restart giữa job không mất dữ liệu.
- Restore backup tạo hệ thống dùng được.
- Sync lại không trùng đơn, âm tồn hoặc lệch công nợ.
- Bộ 100 chứng từ đạt trên cấu hình máy đã nghiệm thu.

Ước lượng: 3–4 tuần.

## R7 — Delivery và Telegram

Mục tiêu: hoàn chỉnh chuỗi xuất kho → giao → ký nhận → cập nhật trạng thái.

### Công việc

- [ ] Thêm role/permission DELIVERY và scope phiếu được gán.
- [ ] Tạo stock deliveries, delivery logs và attachments.
- [ ] Làm UI phân công, danh sách cần giao, giao một phần/thất bại và ký nhận.
- [ ] Snapshot kế toán/thủ kho/người giao/người nhận trên chứng từ.
- [ ] Ops Bot read-only trước: đơn, nợ, tồn, picklist, delivery.
- [ ] Thêm OTP link account, webhook secret, rate limit và audit.
- [ ] Chỉ mở command tạo yêu cầu sau khi approval/idempotency test đạt.
- [ ] Customer Bot chỉ đọc đúng customer đã liên kết.

### Gate R7

- DELIVERY không sửa giá, tồn hoặc công nợ.
- Telegram retry không tạo lệnh/đơn trùng.
- Group không nhận dữ liệu nhạy cảm ngoài quyền.
- Giao một phần tạo trạng thái/log đúng, không tự sửa đơn gốc.

Ước lượng: 2–3 tuần.

## R8 — Mobile Business

Mục tiêu: cho khách cài nhanh bằng PWA trước, sau đó mới phát hành Android/iOS native dùng thật khi cần camera, push, secure storage và offline queue nâng cao.

### Công việc

- [x] Tạo manifest, theme color, icon Android/iOS, maskable icon và Apple touch icon.
- [x] Tạo service worker cho static app shell, không cache API tiền/kho/nợ/chứng từ.
- [x] Thêm prompt cài đặt PWA cho Android và hướng dẫn Safari cho iPhone/iPad.
- [x] Thêm verifier `npm run verify:pwa` và tài liệu `PWA_INSTALL.md`.
- [ ] Deploy production HTTPS và test cài đặt trên Android/iPhone thật.
- [ ] Thêm Capacitor, cấu hình môi trường và deep link.
- [ ] Native app vào thẳng màn hình sử dụng sau đăng nhập.
- [ ] Làm secure storage cho token/device key; loại dữ liệu nhạy cảm khỏi localStorage.
- [ ] Camera capture: permission, crop, rotate, quality check, compress và retry upload.
- [ ] Offline queue mã hóa cho draft; conflict review khi online lại.
- [ ] Push notification theo role với privacy trên lock screen.
- [ ] Tối ưu POS, quét, giao hàng, công nợ và dashboard cho touch/mobile.
- [ ] Build APK/AAB trước; sau gate Android mới build TestFlight/IPA.

### File dự kiến

- `PWA_INSTALL.md`
- `public/manifest.webmanifest` qua build output
- `public/pwa-*.png`
- `public/apple-touch-icon-180x180.png`
- `src/features/pwa/*`
- `scripts/verify-pwa.mjs`
- `capacitor.config.ts`
- `android/`
- `ios/`
- `src/lib/native/*`
- `src/features/offline/*`
- `src/features/notifications/*`

### Gate R8

- PWA production HTTPS cài được trên Android Chrome và iPhone/iPad Safari.
- PWA không cache API giao dịch hoặc dữ liệu nhạy cảm.
- Khi mở từ icon, app vào màn hình sử dụng/login, không phải landing/pricing.
- Test thiết bị thật Android/iPhone đạt camera, login, resume và mất mạng.
- Queue không tạo giao dịch trùng.
- App không chứa landing/pricing hoặc secret server.
- Store privacy/data-safety khai báo đúng.

Ước lượng: 3–4 tuần, chưa gồm thời gian duyệt store.

## R9 — Verification và go-live Update 2.0

Mục tiêu: chứng minh toàn bộ phiên bản hoạt động và có đường rollback.

### Công việc

- [ ] Chạy unit, integration, E2E, permission matrix và failure-path tests.
- [ ] Load/cost test upload, chatbot, quota và concurrent commit.
- [ ] Red-team auth, tenant isolation, prompt injection, file upload và webhook.
- [ ] Diễn tập backup/restore Cloud và Local.
- [ ] Smoke test desktop/mobile/local/production trên đúng release build.
- [ ] Hoàn thiện runbook support, warranty, privacy, retention và incident response.
- [ ] Pilot có giám sát; rollout theo tenant thay vì bật toàn bộ.

### Gate R9

- Không có P0/P1 mở về tiền, kho, nợ, tenant isolation hoặc mất dữ liệu.
- Error/cost/quota/audit quan sát được.
- Rollback application và migration đã diễn tập.
- Tất cả Definition of Done trong `update2.0.md` đạt bằng bằng chứng.

Ước lượng: 1–2 tuần.

## 6. Kế hoạch sprint đề xuất

| Sprint | Trọng tâm | Release outcome |
|---|---|---|
| S0 | R0 baseline production | Nền production được chứng minh |
| S1 | R1 test + modular hóa | Có safety net cho nâng cấp |
| S2 | R2 tenant/entitlement | Khóa đúng năm gói |
| S3–S4 | R3 Document Center | Quét phiếu nhập có review |
| S5 | R4 chatbot read-only | Chatbot đúng quyền |
| S6 | R5 quota/cloud | Cloud MVP bán thử |
| S7–S8 | R6 Local Offline | Bản Windows local |
| S9 | R7 delivery/Telegram | Chuỗi giao hàng và bot nội bộ |
| S10 | R8 PWA installable | Khách cài app nhanh trên Android/iPhone |
| S11–S12 | R8 Android/iOS native | Mobile Business |
| S13 | R9 verification | Go-live Update 2.0 |

Một sprint giả định 1–2 tuần tùy quy mô đội. Không cam kết ngày phát hành trước khi R0/R1 hoàn tất.

## 7. Phụ thuộc và khả năng chạy song song

Có thể song song:

- Thiết kế UI Document Center với migration tenant/license sau khi contract được khóa.
- Chuẩn bị bộ 100 chứng từ trong khi làm R1/R2.
- Thiết kế delivery UX trong khi làm chatbot read-only.
- Chuẩn bị tài khoản store/privacy trong khi xây Local Offline.

Không nên song song:

- Local sync trước khi document/API contract ổn định.
- Mobile offline queue trước khi entitlement/idempotency ổn định.
- Telegram mutation trước delivery approval workflow.
- Customer Bot trước tenant/customer isolation.

## 8. Bộ dữ liệu và kiểm thử bắt buộc

### Chứng từ

- 100–300 chứng từ thật, loại bỏ/che dữ liệu không được phép sử dụng.
- Có ảnh rõ, nghiêng, mờ, nhiều trang, bảng dài, chữ viết tay và biểu mẫu khác nhau.
- Ground truth cho đối tác, ngày, số chứng từ, mã hàng, số lượng, đơn giá, thuế và tổng.

### Permission

- ADMIN, ACCOUNTANT, SALE, WAREHOUSE, DELIVERY, VIEWER và customer-linked bot.
- Mỗi permission kiểm tra `none/own/department/all` ở API và UI.

### Failure path

- Provider timeout/rate limit.
- Upload trùng/virus/file giả MIME.
- Job restart giữa chừng.
- Database rollback.
- Concurrent quota/commit.
- Mất Internet/local restart/mobile background.
- Telegram webhook retry.

## 9. KPI theo dõi pilot

- Tỷ lệ chứng từ cần sửa thủ công.
- Thời gian trung bình từ upload đến commit.
- Tỷ lệ mapping đúng mã hàng.
- Số job retry/fail và chi phí mỗi trang/job.
- Tỷ lệ câu chatbot trả lời đúng nguồn/đúng quyền.
- Số tool call bị chặn bởi permission.
- Số giao dịch trùng, âm tồn hoặc lệch ledger: mục tiêu bằng 0.
- Thời gian backup/restore và tỷ lệ restore thành công.
- Crash-free session mobile/local.
- Ticket hỗ trợ theo tenant/gói.

## 10. Rủi ro và phương án giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sai kết quả quét làm lệch kho/tiền | P0 | Draft + review + rule + RPC commit |
| Chatbot vượt quyền | P0 | Tool registry, permission scope, audit, read-only trước |
| Tenant đọc chéo dữ liệu | P0 | tenant_id, RLS, API tests và anon probes |
| Local/Cloud lệch business logic | P0 | Một transaction contract, contract tests |
| Sync tạo trùng hoặc âm tồn | P0 | Outbox/idempotency/conflict review |
| Chi phí xử lý online vượt giá bán | P1 | Reservation, quota, fallback và cost dashboard |
| Desktop installer khó hỗ trợ | P1 | Một Windows baseline, health bundle, cấu hình nghiệm thu |
| Mobile store từ chối | P1 | Privacy/data safety, tài khoản store của khách, Android trước |
| Năm gói tạo quá nhiều biến thể | P1 | Entitlement, không fork codebase |
| Roadmap kéo dài vì làm tất cả cùng lúc | P1 | Cloud MVP trước, gate bắt buộc, tối đa hai workstream |

## 11. Việc thủ công cần chuẩn bị

- Xác nhận Supabase/Vercel production và migration đã apply.
- Tạo bucket private và retention policy.
- Tạo tài khoản provider xử lý trực tuyến, billing limit và key server-side.
- Chuẩn bị 100–300 chứng từ thật có quyền sử dụng.
- Chọn cấu hình Windows tối thiểu cho Local Offline.
- Chuẩn bị máy Android/iPhone test thật và máy Mac/dịch vụ build iOS.
- Tạo Apple Developer/Google Play Console đứng tên khách hàng hoặc đơn vị bán.
- Tạo Telegram bot/token/group test khi R7 bắt đầu.
- Chốt privacy policy, data processing consent, warranty và support SLA.

## 12. Definition of Done roadmap

- [ ] R0–R2 hoàn tất trước khi phát triển tính năng tính phí.
- [ ] R3–R5 hoàn tất trước khi bán Cloud MVP.
- [ ] R6 hoàn tất trước khi bàn giao Local Offline.
- [ ] R7 hoàn tất trước khi quảng cáo delivery/Telegram.
- [ ] R8 PWA hoàn tất trên thiết bị thật trước khi quảng cáo "cài app trên điện thoại".
- [ ] R8 native hoàn tất trên thiết bị thật trước khi bán Mobile Business đầy đủ.
- [ ] R9 hoàn tất trước khi gọi Update 2.0 production-ready.
- [ ] Mỗi gate có log, report, screenshot hoặc test output làm bằng chứng.
- [ ] `update2.0.md`, `pricing.md`, runbook và trạng thái code không mâu thuẫn.
