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
  // Price/unit are only honored when the actor has orders.price_override; otherwise the catalog row wins.
  productCode?: string;
  productName?: string;
  unit?: string;
  unitPrice?: number;
  lotId?: string;
};

type OrderPayload = {
  customerId?: string;
  warehouseId?: string;
  paymentMethod?: string;
  paidAmount?: number;
  creditAmount?: number;
  discountAmount?: number;
  dueDate?: string;
  note?: string;
  idempotencyKey?: string;
  keepChange?: boolean;
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

    const canOverridePrice = hasPermission(actor.permissions, "orders.price_override");
    const normalizedItems = items.map((item) => ({
      product_id: optionalString(item.productId),
      quantity: toNumber(item.quantity),
      unit_price: canOverridePrice && item.unitPrice !== undefined && item.unitPrice !== null
        ? Math.max(0, toNumber(item.unitPrice))
        : null,
      unit: canOverridePrice ? optionalString(item.unit) ?? null : null,
      lot_id: optionalString(item.lotId) ?? null
    }));
    const warehouseId = hasPermission(actor.permissions, "inventory.manage")
      ? optionalString(body.warehouseId)
      : undefined;
    const discountAmount = canOverridePrice ? toNumber(body.discountAmount) : 0;
    const creditAmount = Math.max(0, toNumber(body.creditAmount));
    if (creditAmount > 0 && !optionalString(body.customerId)) {
      res.status(400).json({ ok: false, error: "Dùng số dư phải chọn khách hàng." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const rpcPayload = {
      p_actor_id: actor.id,
      // PostgREST omits undefined keys from an RPC payload. These parameters are required
      // by the deployed secure function even when their values are intentionally empty.
      p_customer_id: optionalString(body.customerId) ?? null,
      p_warehouse_id: warehouseId ?? null,
      p_items: normalizedItems,
      p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
      p_paid_amount: toNumber(body.paidAmount),
      p_discount_amount: discountAmount,
      p_due_date: optionalString(body.dueDate) ?? null,
      p_note: optionalString(body.note) ?? null,
      p_idempotency_key: idempotencyKey
    };
    let usedLegacyOrderRpc = false;
    let { data, error } = await supabase.rpc("create_sales_order_secure", {
      ...rpcPayload,
      p_allow_price_override: canOverridePrice,
      p_credit_amount: creditAmount
    });
    // The earlier secure RPCs have the same transactional guarantees but miss the newer
    // arguments. Keep POS available while a production database is catching up with its
    // migrations — but never silently drop a requested store-credit payment.
    if (error?.message.includes("p_credit_amount")) {
      if (creditAmount > 0) {
        throw new Error("Server chưa cập nhật chức năng số dư khách hàng (thiếu migration). Vui lòng bỏ chọn dùng số dư hoặc chạy migration.");
      }
      ({ data, error } = await supabase.rpc("create_sales_order_secure", {
        ...rpcPayload,
        p_allow_price_override: canOverridePrice
      }));
    }
    if (error?.message.includes("p_allow_price_override")) {
      usedLegacyOrderRpc = true;
      ({ data, error } = await supabase.rpc("create_sales_order_secure", rpcPayload));
    }
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không tạo được đơn hàng");

    // Khách có tên trả dư tiền + chọn "giữ tiền thừa" -> cộng vào số dư khách, ghi sổ quỹ.
    // Chạy sau khi tạo đơn; nếu lỗi (thiếu migration) không làm hỏng đơn đã tạo.
    const customerId = optionalString(body.customerId);
    const rawPaid = Math.max(0, toNumber(body.paidAmount));
    const orderTotal = Number(data?.order?.total_amount ?? 0);
    const creditUsed = Number(data?.creditUsed ?? 0);
    const overpay = Math.round(rawPaid - orderTotal + creditUsed);
    let overpayKept = 0;
    let overpayWarning: string | undefined;
    if (body.keepChange === true && customerId && overpay > 0) {
      const { data: topup, error: topupError } = await supabase.rpc("topup_customer_credit_secure", {
        p_actor_id: actor.id,
        p_customer_id: customerId,
        p_amount: overpay,
        p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
        p_source_order_id: optionalString(data?.order?.id) ?? null,
        p_note: null,
        p_idempotency_key: `${idempotencyKey}-overpay`
      });
      if (!topupError && topup?.ok) overpayKept = overpay;
      else {
        const reason = topupError?.message ?? topup?.error ?? "lỗi không xác định";
        overpayWarning = `Đơn đã tạo nhưng chưa giữ được tiền thừa vào số dư. Lý do: ${reason}. Hãy cộng số dư thủ công.`;
      }
    }

    // Sheets backup runs best-effort in the background; the daily cron guarantees consistency.
    void bestEffortSyncTables([
      "sales_orders", "sales_order_items", "customers", "customer_debt_ledger", "customer_credit_ledger", "order_debts",
      "receipts", "receipt_allocations", "cashbook_entries", "debt_reminders", "inventory_balances", "inventory_transactions"
    ]);

    res.status(200).json({
      ...data,
      priceSource: "catalog",
      priceOverrideApplied: !usedLegacyOrderRpc && canOverridePrice && discountAmount > 0,
      legacyOrderRpc: usedLegacyOrderRpc,
      overpayKept,
      overpayWarning
    });
  } catch (error) {
    sendError(res, error);
  }
}
