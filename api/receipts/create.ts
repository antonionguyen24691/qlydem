import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { getJsonBody, optionalString, toNumber } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requirePermission } from "../_lib/auth.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

type ReceiptAllocationInput = {
  orderDebtId?: string;
  amount?: number;
};

type ReceiptPayload = {
  customerId?: string;
  amount?: number;
  paymentMethod?: string;
  note?: string;
  idempotencyKey?: string;
  allocations?: ReceiptAllocationInput[];
  // Deprecated and ignored: actor is always read from the bearer session.
  createdBy?: string;
};

function getIdempotencyKey(req: ApiRequest, body: ReceiptPayload) {
  const header = req.headers?.["idempotency-key"] ?? req.headers?.["Idempotency-Key"];
  const value = Array.isArray(header) ? header[0] : header;
  return optionalString(value ?? body.idempotencyKey);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const actor = await requirePermission(req, "finance.receipt.create");
    const body = getJsonBody<ReceiptPayload>(req);
    const customerId = optionalString(body.customerId);
    const idempotencyKey = getIdempotencyKey(req, body);
    if (!customerId || !idempotencyKey) {
      res.status(400).json({ ok: false, error: "Thiếu khách hàng hoặc Idempotency-Key." });
      return;
    }

    const allocations = (body.allocations ?? []).map((item) => ({
      order_debt_id: optionalString(item.orderDebtId),
      amount: toNumber(item.amount)
    }));
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("create_receipt_secure", {
      p_actor_id: actor.id,
      p_customer_id: customerId,
      p_amount: toNumber(body.amount),
      p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
      p_note: optionalString(body.note),
      p_allocations: allocations,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không tạo được phiếu thu.");

    void bestEffortSyncTables([
      "receipts", "receipt_allocations", "customers", "customer_debt_ledger", "order_debts", "cashbook_entries"
    ]);
    res.status(200).json(data);
  } catch (error) {
    sendError(res, error);
  }
}
