import type { ApiRequest, ApiResponse } from "./http.js";
import { methodNotAllowed, sendError } from "./http.js";
import { requirePermission } from "./auth.js";
import { getSupabaseAdmin } from "./supabase.js";

const REQUIRED_TABLES = [
  "users",
  "roles",
  "settings",
  "customers",
  "products",
  "warehouses",
  "inventory_balances",
  "sales_orders",
  "sales_order_items",
  "receipts",
  "customer_debt_ledger",
  "order_debts",
  "debt_reminders",
  "notifications",
  "inventory_adjustment_requests",
  "inventory_adjustment_request_items",
  "inventory_edit_logs",
  "audit_logs",
  "suppliers",
  "purchase_orders",
  "purchase_order_items",
  "supplier_debt_ledger",
  "cashbook_entries",
  "idempotency_keys",
  "history_clear_backups"
];

async function probeTable(table: string) {
  const supabase = getSupabaseAdmin();
  const started = Date.now();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  return {
    table,
    ok: !error,
    count: count ?? 0,
    latencyMs: Date.now() - started,
    error: error?.message
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    await requirePermission(req, "settings.manage");
    const tables = await Promise.all(REQUIRED_TABLES.map(probeTable));
    const missing = tables.filter((item) => !item.ok);

    res.status(200).json({
      ok: true,
      ready: missing.length === 0,
      checkedAt: new Date().toISOString(),
      missingTables: missing.map((item) => item.table),
      tables
    });
  } catch (error) {
    sendError(res, error);
  }
}
