import React, { useMemo, useState } from "react";
import { X, Check } from "lucide-react";

export type LotOption = {
  id: string;
  lotCode: string;
  receivedDate?: string;
  colorNote?: string;
  qualityNote?: string;
  unitCost?: number;
  stock: number;
};

type LotPickerModalProps = {
  isOpen: boolean;
  productName: string;
  lots: LotOption[];
  selectedLotId?: string;
  onSelect: (lot?: LotOption) => void;
  onClose: () => void;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function LotPickerModal({ isOpen, productName, lots, selectedLotId, onSelect, onClose }: LotPickerModalProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const list = term
      ? lots.filter((lot) => [lot.lotCode, lot.colorNote ?? "", lot.qualityNote ?? ""].some((v) => normalize(v).includes(term)))
      : lots;
    return [...list].sort((a, b) => String(a.receivedDate ?? "").localeCompare(String(b.receivedDate ?? "")));
  }, [lots, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Chọn lô hàng</div>
            <div className="text-xs text-zinc-500">{productName}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã lô, màu, chất lượng…"
            className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            autoFocus
          />

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-400">Không có lô còn tồn cho sản phẩm này.</div>
            )}
            {filtered.map((lot) => {
              const active = lot.id === selectedLotId;
              return (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => { onSelect(lot); onClose(); }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:bg-zinc-50"}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <span className="truncate">{lot.lotCode}</span>
                      {active && <Check size={15} className="text-emerald-600" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                      {lot.receivedDate && <span>Nhập: {String(lot.receivedDate).slice(0, 10)}</span>}
                      {lot.colorNote && <span>Màu: {lot.colorNote}</span>}
                      {lot.qualityNote && <span>{lot.qualityNote}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 pl-3 text-right">
                    <div className={`text-sm font-black ${lot.stock > 0 ? "text-emerald-700" : "text-red-600"}`}>{lot.stock.toLocaleString("vi-VN")}</div>
                    <div className="text-[10px] uppercase text-zinc-400">tồn</div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedLotId && (
            <button
              type="button"
              onClick={() => { onSelect(undefined); onClose(); }}
              className="mt-3 w-full rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
            >
              Bỏ chọn lô
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
