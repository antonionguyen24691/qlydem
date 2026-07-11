import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Banknote, Download, Edit3, Plus, Search, Truck, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { getAuthHeaders } from "../lib/supabase";
import { canManageInventory, canViewFinance, isAdmin } from "../lib/permissions";
import { useAuthStore } from "../store/auth";

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  tax_code?: string;
  contact_person?: string;
  payment_terms?: string;
  current_payable?: number;
  status?: string;
  note?: string;
};

type SupplierForm = Omit<Supplier, "id" | "current_payable">;
const emptyForm: SupplierForm = { code: "", name: "", phone: "", address: "", tax_code: "", contact_person: "", payment_terms: "", status: "ACTIVE", note: "" };

export function Suppliers() {
  const user = useAuthStore((state) => state.user);
  const [rows, setRows] = useState<Supplier[]>([]);
  const [term, setTerm] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const loadRows = async () => {
    const response = await fetch("/api/data/suppliers", { headers: await getAuthHeaders() });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được nhà cung cấp.");
    setRows(body.rows ?? []);
  };

  useEffect(() => { void loadRows().catch(() => setRows([])); }, []);

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    return rows.filter((row) => !normalized || [row.code, row.name, row.phone, row.tax_code, row.contact_person].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [rows, term]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({ code: supplier.code ?? "", name: supplier.name ?? "", phone: supplier.phone ?? "", address: supplier.address ?? "", tax_code: supplier.tax_code ?? "", contact_person: supplier.contact_person ?? "", payment_terms: supplier.payment_terms ?? "", status: supplier.status ?? "ACTIVE", note: supplier.note ?? "" });
    setOpen(true);
  };
  const updateForm = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/data/suppliers", { method: editing ? "PATCH" : "POST", headers: { ...(await getAuthHeaders()), "content-type": "application/json" }, body: JSON.stringify({ ...form, id: editing?.id }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được nhà cung cấp.");
      await loadRows();
      setOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được nhà cung cấp.");
    } finally { setSaving(false); }
  };

  const exportSuppliers = async () => {
    setIsExporting(true);
    setImportError("");
    try {
      const response = await fetch("/api/export/supplier-list", { headers: await getAuthHeaders() });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Không xuất được danh sách nhà cung cấp.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `pmql-nha-cung-cap-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Không xuất được danh sách nhà cung cấp.");
    } finally {
      setIsExporting(false);
    }
  };

  const importSuppliers = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setImportMessage("");
    setImportError("");
    try {
      const response = await fetch("/api/import/suppliers", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "x-file-name": encodeURIComponent(file.name) },
        body: await file.arrayBuffer()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không nhập được nhà cung cấp.");
      setImportMessage(`Đã nhập ${body.successRows ?? 0}/${body.totalRows ?? 0} nhà cung cấp.${body.failedRows ? ` ${body.failedRows} dòng cần kiểm tra.` : ""}`);
      await loadRows();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Không nhập được nhà cung cấp.");
    } finally {
      setIsImporting(false);
    }
  };

  const openPayment = (supplier: Supplier) => {
    setPayingSupplier(supplier);
    setPaymentAmount(Number(supplier.current_payable ?? 0) || "");
    setPaymentMethod("CASH");
    setPaymentNote("");
  };

  const paySupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!payingSupplier || !paymentAmount || paymentAmount <= 0) return;
    setIsPaying(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/data/supplier-payments", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ supplierId: payingSupplier.id, amount: paymentAmount, paymentMethod, note: paymentNote, idempotencyKey })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không ghi được thanh toán nhà cung cấp.");
      await loadRows();
      setPayingSupplier(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không ghi được thanh toán nhà cung cấp.");
    } finally {
      setIsPaying(false);
    }
  };

  return <div className="flex h-full flex-col bg-zinc-50">
    <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div><h1 className="text-xl font-bold text-zinc-900">Nhà cung cấp</h1><p className="mt-1 text-sm text-zinc-500">Quản lý NCC, công nợ phải trả và thông tin dùng khi nhập kho.</p></div>
      {canManageInventory(user) && <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:flex sm:items-center">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm nhà cung cấp</Button>
        {isAdmin(user) && <>
          <Button type="button" variant="outline" onClick={exportSuppliers} disabled={isExporting} className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3" title="Xuất XLSX" aria-label="Xuất XLSX">
            <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Xuất XLSX</span>
          </Button>
          <label className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 sm:h-10 sm:w-auto sm:px-3 ${isImporting ? "pointer-events-none opacity-50" : ""}`} title="Nhập XLSX">
            <Upload className="h-4 w-4 sm:mr-2" /><span className="hidden text-sm font-semibold sm:inline">Nhập XLSX</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={isImporting} onChange={(event) => { void importSuppliers(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
        </>}
      </div>}
    </div>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {(importMessage || importError) && <div className={`border-b p-3 text-sm font-medium ${importError ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{importError || importMessage}</div>}
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-500">{filtered.length} nhà cung cấp</div>
          <div className="relative w-full sm:w-96"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><Input value={term} onChange={(event) => { setTerm(event.target.value); setPage(1); }} placeholder="Tìm mã, tên, SĐT, mã số thuế..." className="pl-9" /></div>
        </div>
        <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-sm"><thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500"><tr><th className="px-4 py-3">Nhà cung cấp</th><th className="px-4 py-3">Liên hệ</th><th className="px-4 py-3">Mã số thuế</th><th className="px-4 py-3 text-right">Còn phải trả</th><th className="px-4 py-3 text-center">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-zinc-100">{visible.map((supplier) => <tr key={supplier.id} className="hover:bg-zinc-50"><td className="px-4 py-4"><button type="button" onClick={() => canManageInventory(user) && openEdit(supplier)} className="block text-left"><div className="font-bold text-zinc-900">{supplier.name}</div><div className="mt-1 text-xs text-zinc-500">{supplier.code}</div></button></td><td className="px-4 py-4 text-zinc-600">{supplier.contact_person || supplier.phone || "-"}<div className="text-xs text-zinc-400">{supplier.phone || ""}</div></td><td className="px-4 py-4 text-zinc-600">{supplier.tax_code || "-"}</td><td className="px-4 py-4 text-right font-bold text-red-600">{Number(supplier.current_payable ?? 0).toLocaleString()} ₫</td><td className="px-4 py-4 text-center"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{supplier.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"}</span></td><td className="px-4 py-4 text-right"><div className="inline-flex gap-2">{canViewFinance(user) && Number(supplier.current_payable ?? 0) > 0 && <Button size="sm" onClick={() => openPayment(supplier)}><Banknote className="mr-1 h-3.5 w-3.5" />Thanh toán</Button>}{canManageInventory(user) && <Button size="sm" variant="outline" onClick={() => openEdit(supplier)}><Edit3 className="mr-1 h-3.5 w-3.5" />Sửa</Button>}</div></td></tr>)}</tbody></table></div>
        {visible.length === 0 && <div className="px-4 py-12 text-center text-sm text-zinc-500"><Truck className="mx-auto mb-2 h-8 w-8 text-zinc-300" />Chưa có nhà cung cấp phù hợp.</div>}
        <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="text-zinc-500">Trang {page}/{totalPages}</div><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-md border border-zinc-200 bg-white px-2"><option value={10}>10 / trang</option><option value={20}>20 / trang</option><option value={50}>50 / trang</option></select><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Sau</Button></div></div>
      </div>
    </div>
    <Dialog isOpen={open} onClose={() => setOpen(false)} title={editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"} className="sm:max-w-2xl"><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Mã NCC</label><Input value={form.code} onChange={(event) => updateForm("code", event.target.value)} placeholder="Tự tạo nếu bỏ trống" /></div><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Tên nhà cung cấp *</label><Input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Người liên hệ</label><Input value={form.contact_person} onChange={(event) => updateForm("contact_person", event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Số điện thoại</label><Input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Mã số thuế</label><Input value={form.tax_code} onChange={(event) => updateForm("tax_code", event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Điều khoản thanh toán</label><Input value={form.payment_terms} onChange={(event) => updateForm("payment_terms", event.target.value)} placeholder="VD: 30 ngày" /></div><div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-bold text-zinc-700">Địa chỉ</label><Input value={form.address} onChange={(event) => updateForm("address", event.target.value)} /></div><div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-bold text-zinc-700">Ghi chú</label><textarea value={form.note} onChange={(event) => updateForm("note", event.target.value)} rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" /></div></div><div className="flex gap-3 border-t border-zinc-100 pt-4"><Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" className="flex-1" disabled={saving}>{saving ? "Đang lưu..." : "Lưu nhà cung cấp"}</Button></div></form></Dialog>
    <Dialog isOpen={!!payingSupplier} onClose={() => setPayingSupplier(null)} title="Thanh toán công nợ nhà cung cấp">
      {payingSupplier && <form onSubmit={paySupplier} className="space-y-4">
        <div className="rounded-lg bg-zinc-50 p-3"><div className="font-bold text-zinc-900">{payingSupplier.name}</div><div className="mt-1 text-sm text-red-600">Còn phải trả: {Number(payingSupplier.current_payable ?? 0).toLocaleString()} ₫</div></div>
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Số tiền</label><Input type="number" min={1} max={Number(payingSupplier.current_payable ?? 0)} required value={paymentAmount} onChange={(event) => setPaymentAmount(Number(event.target.value) || "")} /></div>
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Nguồn tiền</label><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CASH" | "TRANSFER")} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></div>
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Ghi chú</label><Input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Nội dung thanh toán..." /></div>
        <div className="flex gap-3 border-t border-zinc-100 pt-4"><Button type="button" variant="outline" className="flex-1" onClick={() => setPayingSupplier(null)}>Hủy</Button><Button type="submit" className="flex-1" disabled={isPaying}>{isPaying ? "Đang ghi..." : "Xác nhận trả"}</Button></div>
      </form>}
    </Dialog>
  </div>;
}
