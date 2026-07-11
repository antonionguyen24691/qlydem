import type { ApiRequest, ApiResponse } from "./http.js";
import { methodNotAllowed, sendError } from "./http.js";
import { requirePermission } from "./auth.js";
import { getJsonBody, optionalString, toStringValue } from "./body.js";
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

const MAX_ARCHIVE_ROWS = 20_000;

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

// Chỉ xóa dữ liệu tạo trước mốc này (nếu có) để tránh lỡ tay xóa cả lịch sử gần đây.
async function countRows(table: string, beforeDate?: string) {
  const supabase = getSupabaseAdmin();
  let query: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (beforeDate) query = query.lte("created_at", beforeDate);
  const { count, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function clearTable(table: string, beforeDate?: string) {
  const supabase = getSupabaseAdmin();
  const before = await countRows(table, beforeDate);
  if (before === 0) return 0;
  let query: any = supabase.from(table).delete().not("id", "is", null);
  if (beforeDate) query = query.lte("created_at", beforeDate);
  const { error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return before;
}

async function createArchive(actorId: string, groups: ClearGroup[], tables: string[], beforeDate?: string) {
  const supabase = getSupabaseAdmin();
  const rowCounts: Record<string, number> = {};
  const snapshot: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of tables) {
    const count = await countRows(table, beforeDate);
    rowCounts[table] = count;
    totalRows += count;
    if (totalRows > MAX_ARCHIVE_ROWS) {
      throw new Error(`Có ${totalRows.toLocaleString("vi-VN")} dòng cần lưu, vượt giới hạn archive ${MAX_ARCHIVE_ROWS.toLocaleString("vi-VN")} dòng. Hãy chạy backup ngoài hệ thống trước khi xóa.`);
    }
    if (count === 0) {
      snapshot[table] = [];
      continue;
    }
    let selectQuery: any = supabase.from(table).select("*");
    if (beforeDate) selectQuery = selectQuery.lte("created_at", beforeDate);
    const { data, error } = await selectQuery;
    if (error) throw new Error(`${table}: ${error.message}`);
    snapshot[table] = data ?? [];
  }

  const { data: archive, error } = await supabase
    .from("history_clear_backups")
    .insert({
      actor_id: actorId,
      groups: groups.map((group) => group.key),
      row_counts: rowCounts,
      snapshot_json: snapshot
    })
    .select("id")
    .single();
  if (error) throw new Error(`Không tạo được archive trước khi xóa: ${error.message}`);
  return { id: archive.id, rowCounts };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  try {
    if (req.method === "GET") {
      await requirePermission(req, "history.clear");
      res.status(200).json({ ok: true, groups: CLEAR_GROUPS });
      return;
    }

    const actor = await requirePermission(req, "history.clear");
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

    // Tùy chọn: chỉ xóa dữ liệu cũ hơn ngày này (ISO). Bỏ trống = xóa toàn bộ như cũ.
    const beforeRaw = optionalString(body.beforeDate);
    let beforeDate: string | undefined;
    if (beforeRaw) {
      const parsed = new Date(beforeRaw);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ ok: false, error: "Ngày giới hạn xóa không hợp lệ." });
        return;
      }
      beforeDate = parsed.toISOString();
    }

    const supabase = getSupabaseAdmin();
    const tables = uniqueTables(selectedGroups);
    const archive = await createArchive(actor.id, selectedGroups, tables, beforeDate);
    const deleted: Record<string, number> = {};
    for (const table of tables) {
      deleted[table] = await clearTable(table, beforeDate);
    }

    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "CLEAR_HISTORY",
      entity_type: "operations",
      entity_id: selectedGroups.map((group) => group.key).join(","),
      after_json: {
        groups: selectedGroups.map((group) => group.label),
        beforeDate: beforeDate ?? null,
        deleted,
        archiveId: archive.id,
        archiveRows: archive.rowCounts
      }
    });

    res.status(200).json({
      ok: true,
      groups: selectedGroups.map((group) => group.key),
      beforeDate: beforeDate ?? null,
      deleted,
      archiveId: archive.id,
      totalDeleted: Object.values(deleted).reduce((sum, value) => sum + value, 0)
    });
  } catch (error) {
    sendError(res, error);
  }
}
