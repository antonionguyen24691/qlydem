-- PMQL — Sổ quỹ: entry_date phải là NGÀY LÀM VIỆC VIỆT NAM, không phải ngày UTC của server.
--
-- Bug: `entry_date date not null default current_date` (20260711) lấy ngày UTC. Giao dịch
-- trong khoảng 00:00–07:00 giờ VN rơi vào ngày UTC hôm trước → tiền thu bị gán sang ngày
-- hôm trước, lệch khỏi đơn hàng ⇒ Dashboard "Thực thu" = 0 dù đơn đã thu đủ.
--
-- An toàn chạy nhiều lần.

-- 1) Mặc định mới: ngày theo giờ Việt Nam
alter table public.cashbook_entries
  alter column entry_date set default ((now() at time zone 'Asia/Ho_Chi_Minh')::date);

-- 2) Sửa dữ liệu cũ bị gán ngày UTC.
--    CHỈ sửa dòng có entry_date trùng ngày UTC của created_at (tức là do default tự gán)
--    VÀ khác ngày VN — giữ nguyên ngày do người dùng tự chọn khi nhập phiếu chi/thu.
update public.cashbook_entries
set entry_date = ((created_at at time zone 'Asia/Ho_Chi_Minh')::date)
where entry_date = ((created_at at time zone 'UTC')::date)
  and entry_date <> ((created_at at time zone 'Asia/Ho_Chi_Minh')::date);
