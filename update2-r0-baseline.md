# Update 2.0 — R0 Baseline Evidence

Ngày kiểm tra: 12/07/2026  
Commit nền: `55d100e` (`harden finance inventory and debt flows`)

## Đã xác minh bằng chạy lệnh

- [x] `npm run verify:hardening` → `Security hardening contract: OK`.
- [x] `npm run verify:finance-integrity` → `Finance integrity contract: OK`.
- [x] `npm run verify:finance-integrity:remote` → production cân bằng với 5 đơn hoạt động, 3 khoản nợ, 3 phiếu thu và 36 số dư kho.
- [x] `npm run typecheck` → đạt.
- [x] `npm run build` → đạt; sau lazy route, bundle chính giảm từ khoảng 544 kB xuống 234 kB và không còn cảnh báo chunk trên 500 kB.
- [x] `npm audit --audit-level=high` → 0 lỗ hổng.

## Gate thủ công còn lại

- [ ] Xác nhận toàn bộ migration hardening/finance đã được ghi nhận trong migration history của Supabase production.
- [ ] Tạo backup production và restore sang project/database kiểm tra.
- [ ] Kiểm tra RLS bằng anon token và từng role trên project production.
- [ ] Xác nhận leaked-password protection/MFA trong Supabase Auth dashboard.
- [ ] Ghi người thực hiện, thời điểm và bằng chứng vào `docs/SECURE_DEPLOY_RUNBOOK.md`.

## Kết luận

Baseline code và read-only production finance probe đạt. Có thể bắt đầu test foundation và phát triển module mới trên source, nhưng chưa được gọi R0 hoàn tất để phát hành Update 2.0 cho khách cho đến khi các gate thủ công được xác nhận.
