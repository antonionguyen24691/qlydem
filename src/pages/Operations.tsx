import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Bell, ClipboardList, Database, History, PackageSearch } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";
import { Button } from "../components/ui/Button";

const sections = [
  { to: "/settings/operations/logs", title: "Nhật ký hoạt động", description: "Tra cứu, tải CSV và dọn nhật ký thao tác của người dùng.", icon: ClipboardList },
  { to: "/settings/operations/history", title: "Dọn dữ liệu lịch sử", description: "Xóa có xác nhận và tự lưu JSON trước khi dọn dữ liệu cũ.", icon: History },
  { to: "/settings/operations/inventory", title: "Hình thức kho", description: "Thiết lập loại phiếu nhập, xuất, kiểm kê và cách tính giá vốn.", icon: PackageSearch },
  { to: "/settings/operations/readiness", title: "Kiểm tra hệ thống", description: "Đối chiếu migration và độ sẵn sàng của các bảng production.", icon: Database }
];

export function Operations() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generateNotifications = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/operations/notifications", { method: "POST", headers: await getAuthHeaders() });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tạo được thông báo.");
      setMessage(`Đã tạo ${body.created ?? 0} thông báo vận hành.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được thông báo.");
    } finally { setLoading(false); }
  };
  return <div className="mobile-mockup-page flex h-full flex-col overflow-hidden bg-zinc-50">
    <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h1 className="text-xl font-bold text-zinc-900">Trung tâm vận hành</h1><p className="mt-1 text-sm text-zinc-500">Mỗi phần có trang riêng để dữ liệu lớn không làm chậm màn Cài đặt.</p></div><Link to="/settings" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Cấu hình</Link></div>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar"><div className="mx-auto max-w-[1200px]">
      {error && <div className="mb-4 rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</div>}
      <div className="mb-5 flex justify-end"><Button type="button" onClick={() => void generateNotifications()} disabled={loading}><Bell className="mr-2 h-4 w-4" />{loading ? "Đang tạo..." : "Tạo nhắc việc"}</Button></div>
      <div className="grid gap-4 md:grid-cols-2">{sections.map(({ to, title, description, icon: Icon }) => <Link key={to} to={to} className="group rounded-[var(--radius-card)] border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"><div className="flex gap-4"><div className="rounded-[var(--radius-control)] bg-emerald-100 p-3 text-emerald-700"><Icon className="h-5 w-5" /></div><div><div className="font-bold text-zinc-900 group-hover:text-emerald-800">{title}</div><p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p><div className="mt-3 text-sm font-bold text-emerald-700">Mở trang →</div></div></div></Link>)}</div>
      <div className="mt-6 rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 text-sm text-zinc-600"><div className="flex items-center gap-2 font-bold text-zinc-900"><Activity className="h-4 w-4 text-emerald-700" />Nguyên tắc vận hành</div><p className="mt-2">Nhật ký được phân trang ở server, chỉ tải số dòng cần xem. Khi xóa log, hệ thống ghi lại một log xác nhận để vẫn truy vết được hành động dọn dữ liệu.</p></div>
    </div></div>
  </div>;
}
