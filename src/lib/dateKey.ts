// Khóa ngày (YYYY-MM-DD) theo NGÀY LÀM VIỆC Việt Nam — dùng nhất quán để gom nhóm
// theo ngày ở Dashboard/Đơn hàng/Tài chính.
//
// Vì sao chốt cứng Asia/Ho_Chi_Minh thay vì giờ máy: dữ liệu trong DB (order_date,
// created_at) là UTC, còn cashbook_entries.entry_date lưu theo ngày VN. Nếu client gom
// nhóm theo giờ máy thì máy lệch múi giờ sẽ ra số khác — doanh thu và thực thu không khớp.
const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

// en-CA cho định dạng YYYY-MM-DD.
const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function localDateKey(value: string | Date = new Date()): string {
  if (typeof value === "string" && value.trim() === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  return vnDateFormatter.format(date);
}
