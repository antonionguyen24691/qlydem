// Khóa ngày (YYYY-MM-DD) theo múi giờ trình duyệt (VN) — dùng nhất quán để gom nhóm
// theo ngày ở Dashboard/Đơn hàng/Tài chính. Tránh lệch ngày do cắt chuỗi UTC thô:
// một đơn tạo gần nửa đêm UTC phải được tính theo NGÀY ĐỊA PHƯƠNG lúc bán.
export function localDateKey(value: string | Date = new Date()): string {
  if (typeof value === "string" && value.trim() === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
