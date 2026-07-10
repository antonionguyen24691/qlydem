import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { getJsonBody, optionalString, toNumber } from "../_lib/body.js";
import { requirePermission } from "../_lib/auth.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

type ReceiptItem = { productId?: string; quantity?: number; unitCost?: number };
type ReceiptPayload = {
  supplierId?: string;
  warehouseCode?: string;
  receivedAt?: string;
  documentCode?: string;
  discountAmount?: number;
  vatAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  note?: string;
  idempotencyKey?: string;
  items?: ReceiptItem[];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const actor = await requirePermission(req, "inventory.manage");
    const body = getJsonBody<ReceiptPayload>(req);
    const header = req.headers?.["idempotency-key"] ?? req.headers?.["Idempotency-Key"];
    const key = optionalString(Array.isArray(header) ? header[0] : header) ?? optionalString(body.idempotencyKey);
    const supplierId = optionalString(body.supplierId);
    const items = (body.items ?? []).map((item) => ({
      product_id: optionalString(item.productId),
      quantity: toNumber(item.quantity),
      unit_cost: toNumber(item.unitCost)
    }));
    if (!supplierId || !key || items.length === 0) {
      res.status(400).json({ ok: false, error: "Thiếu nhà cung cấp, dòng hàng hoặc Idempotency-Key." });
      return;
    }

    const { data, error } = await getSupabaseAdmin().rpc("create_inventory_receipt_secure", {
      p_actor_id: actor.id,
      p_supplier_id: supplierId,
      p_warehouse_code: optionalString(body.warehouseCode) ?? "KHO-CHINH",
      p_received_at: optionalString(body.receivedAt) ?? new Date().toISOString(),
      p_document_code: optionalString(body.documentCode),
      p_discount_amount: toNumber(body.discountAmount),
      p_vat_amount: toNumber(body.vatAmount),
      p_paid_amount: toNumber(body.paidAmount),
      p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
      p_note: optionalString(body.note),
      p_items: items,
      p_idempotency_key: key
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không tạo được phiếu nhập kho.");
    await bestEffortSyncTables([
      "inventory_balances", "inventory_transactions", "purchase_orders", "purchase_order_items",
      "suppliers", "supplier_debt_ledger", "payments", "cashbook_entries"
    ]);
    res.status(200).json(data);
  } catch (error) {
    sendError(res, error);
  }
}
