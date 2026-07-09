import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { getJsonBody, optionalString, toNumber } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requirePermission } from "../_lib/auth.js";
import { hasPermission } from "../_lib/permissions.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

type OrderPayloadItem = {
  productId?: string;
  quantity?: number;
  // Client price/name/code fields are intentionally ignored. The database reads the current catalog row.
  productCode?: string;
  productName?: string;
  unit?: string;
  unitPrice?: number;
};

type OrderPayload = {
  customerId?: string;
  warehouseId?: string;
  paymentMethod?: string;
  paidAmount?: number;
  discountAmount?: number;
  dueDate?: string;
  note?: string;
  idempotencyKey?: string;
  items?: OrderPayloadItem[];
};

function getIdempotencyKey(req: ApiRequest, body: OrderPayload) {
  const header = req.headers?.["idempotency-key"] ?? req.headers?.["Idempotency-Key"];
  const value = Array.isArray(header) ? header[0] : header;
  return optionalString(value ?? body.idempotencyKey);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const actor = await requirePermission(req, "orders.create");
    const body = getJsonBody<OrderPayload>(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    const items = body.items ?? [];
    if (!idempotencyKey) {
      res.status(400).json({ ok: false, error: "Thiếu Idempotency-Key khi tạo đơn hàng." });
      return;
    }
    if (items.length === 0) {
      res.status(400).json({ ok: false, error: "Đơn hàng phải có ít nhất một sản phẩm." });
      return;
    }

    const normalizedItems = items.map((item) => ({
      product_id: optionalString(item.productId),
      quantity: toNumber(item.quantity)
    }));
    const canOverridePrice = hasPermission(actor.permissions, "orders.price_override");
    const warehouseId = hasPermission(actor.permissions, "inventory.manage")
      ? optionalString(body.warehouseId)
      : undefined;
    const discountAmount = canOverridePrice ? toNumber(body.discountAmount) : 0;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("create_sales_order_secure", {
      p_actor_id: actor.id,
      p_customer_id: optionalString(body.customerId),
      p_warehouse_id: warehouseId,
      p_items: normalizedItems,
      p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
      p_paid_amount: toNumber(body.paidAmount),
      p_discount_amount: discountAmount,
      p_due_date: optionalString(body.dueDate),
      p_note: optionalString(body.note),
      p_idempotency_key: idempotencyKey
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không tạo được đơn hàng");

    await bestEffortSyncTables([
      "sales_orders", "sales_order_items", "customers", "customer_debt_ledger", "order_debts",
      "receipts", "receipt_allocations", "cashbook_entries", "debt_reminders", "inventory_balances", "inventory_transactions"
    ]);

    res.status(200).json({
      ...data,
      priceSource: "catalog",
      priceOverrideApplied: canOverridePrice && discountAmount > 0
    });
  } catch (error) {
    sendError(res, error);
  }
}
