import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type AuditLog = {
  id: string;
  actor_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  after_json?: Record<string, unknown>;
  created_at?: string;
};

type AdminUser = { id: string; full_name?: string; email?: string };

const actionLabels: Record<string, string> = {
  CREATE: "Tạo mới", UPSERT: "Tạo/Cập nhật", UPDATE: "Cập nhật", DELETE: "Xóa", DISCONTINUE: "Ngưng bán",
  CANCEL: "Hủy", CLEAR_HISTORY: "Xóa lịch sử", CLEAR_CANCELLED_ORDERS: "Dọn đơn hủy", CLEAR_AUDIT_LOGS: "Xóa nhật ký",
  APPROVE: "Duyệt", REJECT: "Từ chối", ADJUST: "Điều chỉnh"
};

function summary(log: AuditLog) {
  const after = log.after_json;
  if (!after) return log.entity_id ?? "";
  if (after.code || after.name || after.product_name) return [after.code, after.name ?? after.product_name].filter(Boolean).join(" - ");
  const text = JSON.stringify(after);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function OperationsAuditLogs() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const pageSize = 30;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (action) query.set("action", action);
      const headers = await getAuthHeaders();
      const [response, userResponse] = await Promise.all([
        fetch(`/api/operations/audit-logs?${query.toString()}`, { headers }),
        users.length === 0 ? fetch("/api/users", { headers }) : Promise.resolve(null)
      ]);
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được nhật ký hoạt động.");
      setRows(body.rows ?? []);
      setTotal(Number(body.total ?? 0));
      if (userResponse) {
        const userBody = await userResponse.json();
        if (userResponse.ok && userBody.ok) setUsers(userBody.users ?? []);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được nhật ký hoạt động.");
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const actionOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort() as string[], [rows]);
  const visibleRows = rows.filter((row) => !search || `${row.entity_type} ${row.entity_id} ${summary(row)}`.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const actorName = (actorId?: string) => users.find((user) => user.id === actorId)?.full_name || users.find((user) => user.id === actorId)?.email || (actorId ? `${actorId.slice(0, 8)}…` : "Hệ thống");

  const download = async () => {
    setError("");
    try {
      const query = new URLSearchParams({ format: "csv" });
      if (action) query.set("action", action);
      const response = await fetch(`/api/operations/audit-logs?${query.toString()}`, { headers: await getAuthHeaders() });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Không tải được file nhật ký.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Đã tải file CSV nhật ký hoạt động.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được file nhật ký.");
    }
  };

  const clearLogs = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== "XOA_NHAT_KY") {
      setError("Nhập XOA_NHAT_KY để xác nhận xóa nhật ký.");
      return;
    }
    if (!window.confirm("Xóa toàn bộ nhật ký hiện có? Hệ thống sẽ giữ lại một dòng ghi nhận chính thao tác xóa này.")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/operations/audit-logs", {
        method: "DELETE",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không xóa được nhật ký.");
      setDeleteConfirmation("");
      setMessage(`Đã xóa ${Number(body.deleted ?? 0).toLocaleString("vi-VN")} dòng nhật ký. Dòng xác nhận thao tác được giữ lại.`);
      setPage(1);
      await loadLogs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được nhật ký.");
    } finally {
      setDeleting(false);
    }
  };

  return <div className="mobile-mockup-page flex h-full flex-col overflow-hidden bg-zinc-50">
    <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <div className="text-xl font-bold text-zinc-900">Nhật ký hoạt động</div>
        <div className="mt-1 text-sm text-zinc-500">Theo dõi thao tác người dùng, tải lưu trữ và dọn log cũ.</div>
      </div>
      <Link to="/settings/operations" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Vận hành</Link>
    </div>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
      <section className="mx-auto max-w-[1500px] rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 lg:flex-row lg:items-center">
          <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="h-10 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-sm lg:w-56">
            <option value="">Tất cả hành động</option>
            {actionOptions.map((item) => <option key={item} value={item}>{actionLabels[item] ?? item}</option>)}
          </select>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Lọc trong trang đang xem..." className="lg:max-w-xl" />
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Button type="button" variant="outline" onClick={() => void loadLogs()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Button type="button" variant="outline" onClick={() => void download()}><Download className="mr-2 h-4 w-4" />Tải CSV</Button>
          </div>
        </div>
        {error && <div className="m-4 rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
        {message && <div className="m-4 rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"><tr><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Hành động</th><th className="px-4 py-3">Đối tượng</th><th className="px-4 py-3">Chi tiết</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {visibleRows.map((row) => <tr key={row.id} className="hover:bg-zinc-50"><td className="whitespace-nowrap px-4 py-3 text-zinc-500">{row.created_at ? new Date(row.created_at).toLocaleString("vi-VN") : "-"}</td><td className="px-4 py-3 font-medium text-zinc-900">{actorName(row.actor_id)}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{actionLabels[row.action ?? ""] ?? row.action}</span></td><td className="px-4 py-3 text-zinc-700">{row.entity_type ?? "-"}</td><td className="max-w-[420px] truncate px-4 py-3 text-zinc-500" title={summary(row)}>{summary(row)}</td></tr>)}
            </tbody>
          </table>
        </div>
        {!loading && visibleRows.length === 0 && <div className="p-10 text-center text-sm text-zinc-500">Không có bản ghi phù hợp.</div>}
        <div className="flex flex-col gap-3 border-t border-zinc-100 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-zinc-500">{total.toLocaleString("vi-VN")} bản ghi · Trang {page}/{totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trước</Button><Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Sau</Button></div></div>
      </section>
      <section className="mx-auto mt-6 max-w-[1500px] rounded-[var(--radius-card)] border border-red-200 bg-red-50/60 p-4 sm:p-5">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><div className="font-bold text-red-800">Dọn nhật ký hoạt động</div><p className="mt-1 text-sm text-red-700/85">Chỉ ADMIN được xóa. Hãy tải CSV trước khi dọn. Hệ thống luôn giữ một log xác nhận thao tác xóa.</p></div></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="Nhập XOA_NHAT_KY để xác nhận" className="bg-white sm:max-w-md" /><Button type="button" variant="danger" disabled={deleting} onClick={() => void clearLogs()}><Trash2 className="mr-2 h-4 w-4" />{deleting ? "Đang xóa..." : "Xóa toàn bộ log"}</Button></div>
      </section>
    </div>
  </div>;
}
