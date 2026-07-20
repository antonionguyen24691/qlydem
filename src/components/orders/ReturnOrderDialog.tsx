import { useMemo, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { getAuthHeaders } from "../../lib/supabase";
import type { Order } from "../../store/data";

type ReturnLineState = {
  quantity: string;
  condition: "GOOD" | "DEFECTIVE";
};

const REASON_OPTIONS = [
  { value: "HANG_LOI", label: "Hàng lỗi" },
  { value: "HANG_DU", label: "Trả hàng dư" },
  { value: "GIAO_NHAM", label: "Giao nhầm hàng" },
  { value: "KHAC", label: "Lý do khác" }
] as const;

const REFUND_OPTIONS = [
  { value: "CASH", label: "Hoàn tiền mặt" },
  { value: "TRANSFER", label: "Hoàn chuyển khoản" },
  { value: "CREDIT", label: "Cộng vào số dư khách" },
  { value: "DEBT_OFFSET", label: "Cấn trừ công nợ khác" }
] as const;

export function ReturnOrderDialog({
  order,
  onClose,
  onCompleted
}: {
  order: Order;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const isRetail = !order.customerId;
  const [lines, setLines] = useState<Record<string, ReturnLineState>>({});
  const [reasonCode, setReasonCode] = useState<string>("HANG_LOI");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setLine = (itemId: string, patch: Partial<ReturnLineState>) => {
    setLines((prev) => ({
      ...prev,
      [itemId]: { quantity: "", condition: "GOOD", ...prev[itemId], ...patch }
    }));
  };

  const returnItems = useMemo(() => {
    return order.items
      .map((item) => {
        const line = lines[item.id];
        const quantity = Math.min(Number(line?.quantity ?? 0) || 0, item.quantity);
        return { item, quantity, condition: line?.condition ?? "GOOD" };
      })
      .filter((entry) => entry.quantity > 0);
  }, [order.items, lines]);

  const refundTotal = returnItems.reduce((sum, entry) => sum + entry.quantity * entry.item.price, 0);

  const handleSubmit = async () => {
    if (!order.dbId) {
      alert("Đơn chưa đồng bộ server, không thể trả hàng.");
      return;
    }
    if (returnItems.length === 0) {
      alert("Nhập số lượng trả cho ít nhất một dòng hàng.");
      return;
    }
    if (reasonCode === "KHAC" && !reason.trim()) {
      alert("Vui lòng ghi rõ lý do trả hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = window.crypto?.randomUUID?.() ?? `ret-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch("/api/data/sales-returns", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.dbId,
          reasonCode,
          reason: reason.trim() || undefined,
          refundMethod,
          idempotencyKey,
          items: returnItems.map((entry) => ({
            productId: entry.item.id,
            quantity: entry.quantity,
            condition: entry.condition
          }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không tạo được phiếu trả hàng.");
      }
      const parts: string[] = [`Đã trả hàng: ${Number(body.refundTotal ?? refundTotal).toLocaleString()} đ`];
      if (Number(body.debtOffset ?? 0) > 0) parts.push(`Cấn trừ nợ: ${Number(body.debtOffset).toLocaleString()} đ`);
      if (Number(body.cashRefund ?? 0) > 0) parts.push(`Hoàn tiền: ${Number(body.cashRefund).toLocaleString()} đ`);
      if (Number(body.creditRefund ?? 0) > 0) parts.push(`Cộng số dư: ${Number(body.creditRefund).toLocaleString()} đ`);
      alert(parts.join("\n"));
      onCompleted();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không tạo được phiếu trả hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen onClose={onClose} title={`Trả hàng đơn ${order.id}`}>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-1">
          {order.items.map((item) => {
            const line = lines[item.id];
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-zinc-900">{item.name}</div>
                  <div className="text-xs text-zinc-500">Đã mua: {item.quantity} {item.unit} × {item.price.toLocaleString()} đ</div>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={item.quantity}
                  placeholder="SL trả"
                  value={line?.quantity ?? ""}
                  onChange={(event) => setLine(item.id, { quantity: event.target.value })}
                  className="w-24 text-right !min-h-[36px] !h-9"
                />
                <select
                  value={line?.condition ?? "GOOD"}
                  onChange={(event) => setLine(item.id, { condition: event.target.value as "GOOD" | "DEFECTIVE" })}
                  className="h-9 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
                >
                  <option value="GOOD">Hàng tốt → kho bán</option>
                  <option value="DEFECTIVE">Hàng lỗi → kho lỗi</option>
                </select>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">Lý do trả hàng</span>
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">Hoàn tiền (phần vượt nợ đơn)</span>
            <select
              value={refundMethod}
              onChange={(event) => setRefundMethod(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
            >
              {REFUND_OPTIONS.filter((option) => !isRetail || option.value === "CASH" || option.value === "TRANSFER").map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <Input
          type="text"
          placeholder="Ghi chú/lý do chi tiết..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="rounded-[var(--radius-card)] bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200/60">
          <div className="flex justify-between font-semibold text-zinc-900">
            <span>Tổng tiền hàng trả</span>
            <span className="text-emerald-600">{refundTotal.toLocaleString()} đ</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Tiền trả sẽ tự cấn vào phần nợ còn lại của đơn này trước; phần dư mới hoàn theo phương thức đã chọn.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Đóng</Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting || returnItems.length === 0}>
            {isSubmitting ? "Đang xử lý..." : "Xác nhận trả hàng"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
