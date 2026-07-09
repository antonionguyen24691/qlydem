import type { ApiRequest, ApiResponse } from "./http.js";
import { methodNotAllowed, sendError } from "./http.js";
import { requireAuth } from "./auth.js";
import { getJsonBody, toStringValue } from "./body.js";
import { getSupabaseAdmin } from "./supabase.js";

type ClearGroup = {
  key: string;
  label: string;
  tables: string[];
};

const CLEAR_GROUPS: ClearGroup[] = [
  {
    key: "sales",
    label: "Lịch sử đơn hàng bán",
    tables: [
      "sales_order_items",
      "receipt_allocations",
      "receipts",
      "debt_reminder_logs",
      "debt_reminders",
      "payment_promises",
      "customer_debt_ledger",
      "order_debts",
      "cashbook_entries",
      "sales_orders"
    ]
  },
  {
    key: "finance",
    label: "Lịch sử thu tiền/công nợ",
    tables: [
      "receipt_allocations",
      "receipts",
      "customer_debt_ledger",
      "order_debts",
      "cashbook_entries",
      "debt_reminder_logs",
      "debt_reminders",
      "payment_promises"
    ]
  },
  {
    key: "purchase",
    label: "Lịch sử mua/nhập hàng",
    tables: ["purchase_order_items", "purchase_orders", "supplier_debt_ledger"]
  },
  {
    key: "inventory",
    label: "Lịch sử xuất/nhập/kiểm kho",
    tables: [
      "inventory_adjustment_request_items",
      "inventory_adjustment_requests",
      "inventory_edit_logs",
      "inventory_transactions"
    ]
  },
  {
    key: "notifications",
    label: "Thông báo và nhắc việc",
    tables: ["notifications", "debt_reminder_logs", "debt_reminders"]
  },
  {
    key: "imports",
    label: "Lịch sử import dữ liệu",
    tables: ["import_errors", "import_batches"]
  }
];

function uniqueTables(groups: ClearGroup[]) {
  const seen = new Set<string>();
  const tables: string[] = [];
  for (const group of groups) {
    for (const table of group.tables) {
      if (seen.has(table)) continue;
      seen.add(table);
      tables.push(table);
    }
  }
  return tables;
}

async function countRows(table: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function clearTable(table: string) {
  const supabase = getSupabaseAdmin();
  const before = await countRows(table);
  if (before === 0) return 0;
  const { error } = await supabase
    .from(table)
    .delete()
    .not("id", "is", null);
  if (error) throw new Error(`${table}: ${error.message}`);
  return before;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  try {
    if (req.method === "GET") {
      await requireAuth(req, ["ADMIN"]);
      res.status(200).json({ ok: true, groups: CLEAR_GROUPS });
      return;
    }

    const actor = await requireAuth(req, ["ADMIN"]);
    const body = getJsonBody(req);
    const confirmation = toStringValue(body.confirmation).trim().toUpperCase();
    const requested = Array.isArray(body.groups) ? body.groups.map((item) => toStringValue(item).trim()) : [];

    if (confirmation !== "XOA") {
      res.status(400).json({ ok: false, error: "Vui lòng nhập XOA để xác nhận xóa lịch sử." });
      return;
    }

    const selectedGroups = CLEAR_GROUPS.filter((group) => requested.includes(group.key));
    if (selectedGroups.length === 0) {
      res.status(400).json({ ok: false, error: "Chưa chọn nhóm lịch sử cần xóa." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const tables = uniqueTables(selectedGroups);
    const deleted: Record<string, number> = {};
    for (const table of tables) {
      deleted[table] = await clearTable(table);
    }

    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "CLEAR_HISTORY",
      entity_type: "operations",
      entity_id: selectedGroups.map((group) => group.key).join(","),
      after_json: {
        groups: selectedGroups.map((group) => group.label),
        deleted
      }
    });

    res.status(200).json({
      ok: true,
      groups: selectedGroups.map((group) => group.key),
      deleted,
      totalDeleted: Object.values(deleted).reduce((sum, value) => sum + value, 0)
    });
  } catch (error) {
    sendError(res, error);
  }
}
