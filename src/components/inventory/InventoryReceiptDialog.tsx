import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SearchableSelect } from "../ui/SearchableSelect";
import { getAuthHeaders } from "../../lib/supabase";
import type { Product } from "../../store/data";

type Supplier = { id: string; code?: string; name: string; phone?: string };
type ReceiptLine = { productId: string; quantity: number; unitCost: number; unit: string };

type InventoryReceiptDialogProps = {
  isOpen: boolean;
  products: Product[];
  suppliers: Supplier[];
  initialProductId?: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const emptyLine = (): ReceiptLine => ({ productId: "", quantity: 1, unitCost: 0, unit: "" });

export function InventoryReceiptDialog({ isOpen, products, suppliers, initialProductId, onClose, onSaved }: InventoryReceiptDialogProps) {
  const [supplierId, setSupplierId] = useState("");
  const [documentCode, setDocumentCode] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [discountAmount, setDiscountAmount] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>(() => initialProductId
    ? [{ ...emptyLine(), productId: initialProductId, unit: products.find((item) => item.id === initialProductId)?.unit ?? "" }]
    : [emptyLine()]);
  const [isSaving, setIsSaving] = useState(false);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), [lines]);
  const total = Math.max(0, subtotal - discountAmount + vatAmount);
  const payable = Math.max(0, total - paidAmount);

  const close = () => {
    if (isSaving) return;
    onClose();
  };
  const updateLine = (index: number, patch: Partial<ReceiptLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const reset = () => {
    setSupplierId("");
    setDocumentCode("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setDiscountAmount(0);
    setVatAmount(0);
    setPaidAmount(0);
    setPaymentMethod("CASH");
    setNote("");
    setLines(initialProductId
      ? [{ ...emptyLine(), productId: initialProductId, unit: products.find((item) => item.id === initialProductId)?.unit ?? "" }]
      : [emptyLine()]);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const productIds = lines.map((line) => line.productId).filter(Boolean);
    if (!supplierId || productIds.length !== lines.length || lines.some((line) => line.quantity <= 0 || line.unitCost < 0)) {
      alert("Chọn nhà cung cấp và nhập đủ sản phẩm, số lượng, giá nhập.");
      return;
    }
    if (new Set(productIds).size !== productIds.length) {
      alert("Mỗi hàng hóa chỉ nên xuất hiện một lần trong phiếu nhập.");
      return;
    }
    if (paidAmount > total) {
      alert("Số đã trả không thể lớn hơn tổng nhập.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/data/inventory-receipts", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ supplierId, warehouseCode: "KHO-CHINH", receivedAt, documentCode, discountAmount, vatAmount, paidAmount, paymentMethod, note, items: lines })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tạo được phiếu nhập kho.");
      await onSaved();
      reset();
      onClose();
      alert(`Đã nhập kho ${lines.length} dòng hàng. Phiếu ${body.purchase?.code ?? "đã được ghi nhận"}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không tạo được phiếu nhập kho.");
    } finally {
      setIsSaving(false);
    }
  };

  return <Dialog isOpen={isOpen} onClose={close} title="Phiếu nhập kho" className="sm:max-w-5xl">
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Nhà cung cấp *</label><SearchableSelect value={supplierId} onChange={setSupplierId} required placeholder="Chọn nhà cung cấp" searchPlaceholder="Tìm mã hoặc tên NCC…" options={suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code ? `${supplier.code} - ` : ""}${supplier.name}`, description: supplier.phone }))} /></div>
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Ngày nhập</label><Input name="receivedAt" type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></div>
        <div><label className="mb-1.5 block text-sm font-bold text-zinc-700">Số chứng từ NCC</label><Input name="documentCode" value={documentCode} onChange={(event) => setDocumentCode(event.target.value)} placeholder="Tự tạo nếu để trống" /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-[880px] w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-3">Hàng hóa</th><th className="w-32 px-3 py-3 text-right">Số lượng</th><th className="w-28 px-3 py-3">ĐVT</th><th className="w-40 px-3 py-3 text-right">Giá nhập</th><th className="w-40 px-3 py-3 text-right">Thành tiền</th><th className="w-12 px-3 py-3" /></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {lines.map((line, index) => {
              const product = products.find((item) => item.id === line.productId);
              return <tr key={`${index}-${line.productId}`}><td className="px-3 py-2"><SearchableSelect value={line.productId} onChange={(value) => { const picked = products.find((item) => item.id === value); updateLine(index, { productId: value, unitCost: Number(picked?.cost ?? 0), unit: picked?.unit ?? "" }); }} placeholder="Chọn hàng hóa" searchPlaceholder="Tìm mã hoặc tên hàng…" options={products.map((item) => ({ value: item.id, label: `${item.code} - ${item.name}`, description: `Tồn ${item.stock.toLocaleString()} ${item.unit}` }))} /></td><td className="px-3 py-2"><Input name={`quantity-${index}`} type="number" min="0.001" step="any" value={line.quantity || ""} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 0 })} className="text-right" /></td><td className="px-3 py-2"><Input name={`unit-${index}`} value={product?.unit ?? line.unit} readOnly className="bg-zinc-50 uppercase text-zinc-500" title="Đổi đơn vị tại Danh mục hàng hóa trước khi nhập kho" /></td><td className="px-3 py-2"><Input name={`cost-${index}`} type="number" min="0" value={line.unitCost || ""} onChange={(event) => updateLine(index, { unitCost: Number(event.target.value) || 0 })} className="text-right" /></td><td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-900">{(line.quantity * line.unitCost).toLocaleString()} ₫<div className="text-xs font-normal text-zinc-500">{product?.unit || line.unit || ""}</div></td><td className="px-3 py-2 text-right"><Button type="button" aria-label="Xóa dòng hàng" variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4" /></Button></td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}><Plus className="mr-2 h-4 w-4" />Thêm dòng hàng</Button>

      <div className="grid gap-3 sm:grid-cols-4"><div><label className="mb-1.5 block text-sm font-medium text-zinc-700">Giảm giá</label><Input name="discountAmount" type="number" min="0" value={discountAmount || ""} onChange={(event) => setDiscountAmount(Number(event.target.value) || 0)} /></div><div><label className="mb-1.5 block text-sm font-medium text-zinc-700">VAT/chi phí</label><Input name="vatAmount" type="number" min="0" value={vatAmount || ""} onChange={(event) => setVatAmount(Number(event.target.value) || 0)} /></div><div><label className="mb-1.5 block text-sm font-medium text-zinc-700">Đã trả</label><Input name="paidAmount" type="number" min="0" value={paidAmount || ""} onChange={(event) => setPaidAmount(Number(event.target.value) || 0)} /></div><div><label className="mb-1.5 block text-sm font-medium text-zinc-700">Phương thức</label><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option><option value="CARD">Thẻ</option><option value="OTHER">Khác</option></select></div></div>
      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3"><div><div className="text-xs font-bold uppercase text-zinc-500">Tiền hàng</div><div className="mt-1 font-black tabular-nums text-zinc-900">{subtotal.toLocaleString()} ₫</div></div><div><div className="text-xs font-bold uppercase text-zinc-500">Tổng nhập</div><div className="mt-1 font-black tabular-nums text-emerald-700">{total.toLocaleString()} ₫</div></div><div><div className="text-xs font-bold uppercase text-zinc-500">Còn phải trả</div><div className="mt-1 font-black tabular-nums text-red-600">{payable.toLocaleString()} ₫</div></div></div>
      <div><label className="mb-1.5 block text-sm font-medium text-zinc-700">Ghi chú</label><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Ghi chú phiếu nhập…" className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" /></div>
      <div className="flex gap-3 border-t border-zinc-100 pt-4"><Button type="button" variant="outline" className="flex-1" onClick={close}>Hủy</Button><Button type="submit" className="flex-1" disabled={isSaving}>{isSaving ? "Đang ghi nhận…" : "Hoàn tất nhập kho"}</Button></div>
    </form>
  </Dialog>;
}
