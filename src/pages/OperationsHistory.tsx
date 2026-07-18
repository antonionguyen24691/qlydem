import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ShieldAlert, Trash2 } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const historyGroups = [
  { key: "sales", label: "Lịch sử đơn hàng bán", description: "Đơn bán, dòng hàng, công nợ gắn với đơn." },
  { key: "finance", label: "Lịch sử thu tiền/công nợ", description: "Phiếu thu, sổ quỹ, nhắc nợ và phân bổ thu." },
  { key: "purchase", label: "Lịch sử mua/nhập hàng", description: "Đơn nhập mua và công nợ nhà cung cấp." },
  { key: "inventory", label: "Lịch sử xuất/nhập/kiểm kho", description: "Giao dịch kho, lệnh duyệt kiểm kê, log sửa tồn." },
  { key: "notifications", label: "Thông báo và nhắc việc", description: "Thông báo nội bộ và các nhắc việc công nợ." },
  { key: "imports", label: "Lịch sử import dữ liệu", description: "Batch import và lỗi import Excel." },
  { key: "cancelled-orders", label: "Đơn đã hủy", description: "Xóa vĩnh viễn đơn hủy; phiếu thu và sổ quỹ được giữ." }
];
const masterGroups = [
  { key: "master-customers", label: "DANH MỤC khách hàng", description: "Xóa toàn bộ khách hàng và liên hệ. Cần xóa lịch sử bán trước." },
  { key: "master-suppliers", label: "DANH MỤC nhà cung cấp", description: "Xóa toàn bộ NCC. Cần xóa lịch sử nhập hàng trước." },
  { key: "master-products", label: "DANH MỤC sản phẩm & tồn kho", description: "Xóa hàng hóa, tồn kho và lịch sử giá. Cần xóa lịch sử liên quan trước." }
];
type Archive = { id: string; groups: string[]; row_counts: Record<string, number>; created_at: string };
type Group = (typeof historyGroups)[number];

export function OperationsHistory() {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [archives, setArchives] = useState<Archive[]>([]);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [downloading, setDownloading] = useState("");

  const loadArchives = async () => {
    try {
      const response = await fetch("/api/operations/clear-history-archives", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (response.ok && body.ok) setArchives(body.archives ?? []);
    } catch { /* Explicit actions provide their own error message. */ }
  };
  useEffect(() => { void loadArchives(); }, []);

  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const clear = async () => {
    if (!selected.length) return setError("Chưa chọn nhóm dữ liệu cần xóa.");
    if (confirmation.trim().toUpperCase() !== "XOA") return setError("Nhập XOA để xác nhận xóa dữ liệu.");
    const labels = [...historyGroups, ...masterGroups].filter((item) => selected.includes(item.key)).map((item) => item.label).join(", ");
    if (!window.confirm(`Xóa vĩnh viễn: ${labels}?`)) return;
    if (selected.some((item) => item.startsWith("master-")) && !window.confirm("Bạn đang xóa DANH MỤC gốc. Dữ liệu không thể khôi phục trong app, chỉ còn bản JSON. Xác nhận lần cuối?")) return;
    setClearing(true); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/operations/clear-history", {
        method: "POST", headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ groups: selected, confirmation })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không xóa được dữ liệu.");
      setResult(body.deleted ?? {}); setConfirmation(""); setSelected([]);
      setMessage(`Đã xóa ${Number(body.totalDeleted ?? 0).toLocaleString("vi-VN")} dòng dữ liệu.`);
      await loadArchives();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không xóa được dữ liệu."); } finally { setClearing(false); }
  };
  const downloadArchive = async (id: string) => {
    setDownloading(id); setError("");
    try {
      const response = await fetch(`/api/operations/clear-history-archives?id=${encodeURIComponent(id)}`, { headers: await getAuthHeaders() });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được bản lưu.");
      const url = URL.createObjectURL(new Blob([JSON.stringify(body.archive, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `backup-truoc-khi-xoa-${id.slice(0, 8)}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được bản lưu."); } finally { setDownloading(""); }
  };
  const groupCard = (item: Group, dangerous = false) => <label key={item.key} className={`flex cursor-pointer gap-3 rounded-[var(--radius-card)] border bg-white p-3 ${dangerous ? "border-red-200" : "border-zinc-200"}`}>
    <input type="checkbox" checked={selected.includes(item.key)} onChange={() => toggle(item.key)} className="mt-1 h-4 w-4 accent-red-600" />
    <span><span className={`block font-bold ${dangerous ? "text-red-700" : "text-zinc-900"}`}>{item.label}</span><span className="mt-1 block text-xs text-zinc-500">{item.description}</span></span>
  </label>;

  return <div className="mobile-mockup-page flex h-full flex-col overflow-hidden bg-zinc-50">
    <Header title="Dọn dữ liệu lịch sử" subtitle="Dọn theo nhóm, có xác nhận và backup JSON tự động." />
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar"><div className="mx-auto max-w-[1200px] space-y-6">
      {error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
      <section className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/60 p-4 sm:p-5">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><h2 className="font-bold text-red-800">Chọn dữ liệu cần dọn</h2><p className="mt-1 text-sm text-red-700/85">Các bản ghi xóa được snapshot trước để tải về khi cần truy vết.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{historyGroups.map((item) => groupCard(item))}</div>
        <div className="mt-5 border-t border-red-200 pt-4"><div className="font-bold text-red-800">Danh mục gốc, cực kỳ nguy hiểm</div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{masterGroups.map((item) => groupCard(item, true))}</div></div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Nhập XOA để xác nhận" className="bg-white sm:max-w-md" /><Button type="button" variant="danger" disabled={clearing} onClick={() => void clear()}><Trash2 className="mr-2 h-4 w-4" />{clearing ? "Đang xóa..." : "Xóa dữ liệu đã chọn"}</Button></div>
      </section>
      {result && <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4"><h2 className="font-bold text-zinc-900">Kết quả xóa</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(result).map(([table, count]) => <div key={table} className="flex justify-between rounded bg-zinc-50 px-3 py-2 text-sm"><span className="text-zinc-500">{table}</span><span className="font-bold">{Number(count).toLocaleString("vi-VN")}</span></div>)}</div></section>}
      <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white"><div className="border-b border-zinc-100 p-4"><h2 className="font-bold text-zinc-900">Bản lưu trước khi xóa</h2><p className="mt-1 text-sm text-zinc-500">Tải JSON để lưu trữ ngoài hệ thống.</p></div><div className="divide-y divide-zinc-100">{archives.map((archive) => <div key={archive.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold text-zinc-900">{new Date(archive.created_at).toLocaleString("vi-VN")}</div><div className="mt-1 text-xs text-zinc-500">{archive.groups.join(", ")} · {Object.values(archive.row_counts ?? {}).reduce<number>((sum, count) => sum + Number(count ?? 0), 0).toLocaleString("vi-VN")} dòng</div></div><Button type="button" size="sm" variant="outline" disabled={downloading === archive.id} onClick={() => void downloadArchive(archive.id)}><Download className="mr-2 h-4 w-4" />{downloading === archive.id ? "Đang tải..." : "Tải JSON"}</Button></div>)}{archives.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">Chưa có bản lưu.</div>}</div></section>
    </div></div>
  </div>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h1 className="text-xl font-bold text-zinc-900">{title}</h1><p className="mt-1 text-sm text-zinc-500">{subtitle}</p></div><Link to="/settings/operations" className="text-sm font-bold text-emerald-700">← Vận hành</Link></div>; }
function Notice({ tone, children }: { tone: "error" | "success"; children: string }) { return <div className={`rounded-[var(--radius-control)] border p-3 text-sm ${tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{children}</div>; }
