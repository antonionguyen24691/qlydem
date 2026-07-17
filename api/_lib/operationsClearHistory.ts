import type { ApiRequest, ApiResponse } from "./http.js";
import { getQueryValue, methodNotAllowed, sendError } from "./http.js";
import { requirePermission } from "./auth.js";
import { getJsonBody, optionalString, toStringValue } from "./body.js";
import { getSupabaseAdmin } from "./supabase.js";

type ClearGroup = {
  key: string;
  label: string;
  tables: string[];
};

// Thứ tự bảng trong mỗi nhóm là thứ tự xóa: bảng con (FK) phải đứng trước bảng cha.
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
    // payments tham chiếu purchase_orders (không cascade) nên phải xóa trước.
    tables: ["payments", "purchase_order_items", "purchase_orders", "supplier_debt_ledger"]
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
const SELECT_PAGE_SIZE = 1000;
const UPDATE_CHUNK_SIZE = 20;

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

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// PostgREST giới hạn 1000 dòng mỗi lần select nên phải phân trang thủ công.
async function selectAllRows(
  table: string,
  columns: string,
  applyFilter?: (query: any) => any
) {
  const supabase = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    let query: any = supabase.from(table).select(columns).range(from, from + SELECT_PAGE_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < SELECT_PAGE_SIZE) break;
  }
  return rows;
}

async function runChunked<T>(items: T[], worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += UPDATE_CHUNK_SIZE) {
    await Promise.all(items.slice(index, index + UPDATE_CHUNK_SIZE).map(worker));
  }
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
    snapshot[table] = await selectAllRows(table, "*", (query) =>
      beforeDate ? query.lte("created_at", beforeDate) : query
    );
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

// ===== Đồng bộ lại số dư sau khi xóa lịch sử =====
// current_debt / current_payable / total_revenue là số dư dồn (denormalized);
// nếu chỉ xóa các bảng lịch sử mà không tính lại, công nợ cũ vẫn hiển thị.

// Đơn còn ghi nợ nhưng phiếu công nợ (order_debts) đã bị xóa → coi như tất toán.
async function settleOrphanedOrderDebts() {
  const supabase = getSupabaseAdmin();
  const orders = await selectAllRows(
    "sales_orders",
    "id,total_amount,debt_amount,status",
    (query) => query.gt("debt_amount", 0).neq("status", "CANCELLED")
  );
  if (orders.length === 0) return 0;
  const remainingDebts = await selectAllRows("order_debts", "order_id");
  const orderIdsWithDebt = new Set(remainingDebts.map((row) => row.order_id));
  const orphaned = orders.filter((order) => !orderIdsWithDebt.has(order.id));
  await runChunked(orphaned, async (order) => {
    const { error } = await supabase
      .from("sales_orders")
      .update({ paid_amount: money(order.total_amount), debt_amount: 0, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) throw new Error(`sales_orders: ${error.message}`);
  });
  return orphaned.length;
}

// Tính lại customers.current_debt = tổng nợ còn lại của phiếu công nợ mở
// + phần điều chỉnh thủ công còn lại trong sổ cái.
async function resyncCustomerDebts() {
  const supabase = getSupabaseAdmin();
  const debtByCustomer = new Map<string, number>();

  const openDebts = await selectAllRows(
    "order_debts",
    "customer_id,remaining_amount,status",
    (query) => query.neq("status", "CLOSED")
  );
  for (const row of openDebts) {
    debtByCustomer.set(row.customer_id, (debtByCustomer.get(row.customer_id) ?? 0) + money(row.remaining_amount));
  }

  const adjustments = await selectAllRows(
    "customer_debt_ledger",
    "customer_id,debit,credit",
    (query) => query.eq("source_type", "ADJUSTMENT")
  );
  for (const row of adjustments) {
    debtByCustomer.set(row.customer_id, (debtByCustomer.get(row.customer_id) ?? 0) + money(row.debit) - money(row.credit));
  }

  const customers = await selectAllRows("customers", "id,current_debt");
  const stale = customers.filter((customer) => {
    const target = Math.max(0, round2(debtByCustomer.get(customer.id) ?? 0));
    return Math.abs(money(customer.current_debt) - target) >= 0.005;
  });
  await runChunked(stale, async (customer) => {
    const target = Math.max(0, round2(debtByCustomer.get(customer.id) ?? 0));
    const { error } = await supabase
      .from("customers")
      .update({ current_debt: target, updated_at: new Date().toISOString() })
      .eq("id", customer.id);
    if (error) throw new Error(`customers: ${error.message}`);
  });
  return stale.length;
}

// Tính lại doanh thu lũy kế và ngày mua gần nhất từ các đơn còn lại.
async function resyncCustomerSalesStats() {
  const supabase = getSupabaseAdmin();
  const orders = await selectAllRows(
    "sales_orders",
    "customer_id,total_amount,order_date",
    (query) => query.neq("status", "CANCELLED").not("customer_id", "is", null)
  );
  const revenueByCustomer = new Map<string, number>();
  const lastOrderByCustomer = new Map<string, string>();
  for (const row of orders) {
    revenueByCustomer.set(row.customer_id, (revenueByCustomer.get(row.customer_id) ?? 0) + money(row.total_amount));
    const orderDate = String(row.order_date ?? "");
    if (orderDate && orderDate > (lastOrderByCustomer.get(row.customer_id) ?? "")) {
      lastOrderByCustomer.set(row.customer_id, orderDate);
    }
  }

  const customers = await selectAllRows("customers", "id,total_revenue,last_order_at");
  const stale = customers.filter((customer) => {
    const targetRevenue = round2(revenueByCustomer.get(customer.id) ?? 0);
    const targetLastOrder = lastOrderByCustomer.get(customer.id) ?? null;
    return Math.abs(money(customer.total_revenue) - targetRevenue) >= 0.005
      || Boolean(customer.last_order_at) !== Boolean(targetLastOrder);
  });
  await runChunked(stale, async (customer) => {
    const { error } = await supabase
      .from("customers")
      .update({
        total_revenue: round2(revenueByCustomer.get(customer.id) ?? 0),
        last_order_at: lastOrderByCustomer.get(customer.id) ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);
    if (error) throw new Error(`customers: ${error.message}`);
  });
  return stale.length;
}

// Tính lại suppliers.current_payable = tổng còn phải trả của các phiếu nhập còn lại.
async function resyncSupplierPayables() {
  const supabase = getSupabaseAdmin();
  const purchases = await selectAllRows(
    "purchase_orders",
    "supplier_id,payable_amount,status",
    (query) => query.neq("status", "CANCELLED").not("supplier_id", "is", null)
  );
  const payableBySupplier = new Map<string, number>();
  for (const row of purchases) {
    payableBySupplier.set(row.supplier_id, (payableBySupplier.get(row.supplier_id) ?? 0) + money(row.payable_amount));
  }

  const suppliers = await selectAllRows("suppliers", "id,current_payable");
  const stale = suppliers.filter((supplier) => {
    const target = Math.max(0, round2(payableBySupplier.get(supplier.id) ?? 0));
    return Math.abs(money(supplier.current_payable) - target) >= 0.005;
  });
  await runChunked(stale, async (supplier) => {
    const target = Math.max(0, round2(payableBySupplier.get(supplier.id) ?? 0));
    const { error } = await supabase
      .from("suppliers")
      .update({ current_payable: target, updated_at: new Date().toISOString() })
      .eq("id", supplier.id);
    if (error) throw new Error(`suppliers: ${error.message}`);
  });
  return stale.length;
}

async function resyncBalancesAfterClear(clearedTables: string[]) {
  const cleared = new Set(clearedTables);
  const resynced: Record<string, number> = {};
  if (cleared.has("order_debts")) {
    resynced.settledOrders = await settleOrphanedOrderDebts();
    resynced.customerDebts = await resyncCustomerDebts();
  }
  if (cleared.has("sales_orders")) {
    resynced.customerSalesStats = await resyncCustomerSalesStats();
  }
  if (cleared.has("purchase_orders") || cleared.has("supplier_debt_ledger")) {
    resynced.supplierPayables = await resyncSupplierPayables();
  }
  return resynced;
}

// Danh sách/tải các bản lưu tự động tạo trước mỗi lần xóa lịch sử.
export async function archivesHandler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    await requirePermission(req, "history.clear");
    const supabase = getSupabaseAdmin();
    const archiveId = getQueryValue(req.query?.id);
    if (archiveId) {
      const { data, error } = await supabase
        .from("history_clear_backups")
        .select("*")
        .eq("id", archiveId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        res.status(404).json({ ok: false, error: "Không tìm thấy bản lưu." });
        return;
      }
      res.status(200).json({ ok: true, archive: data });
      return;
    }
    const { data, error } = await supabase
      .from("history_clear_backups")
      .select("id,actor_id,groups,row_counts,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true, archives: data ?? [] });
  } catch (error) {
    sendError(res, error);
  }
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
    const resynced = await resyncBalancesAfterClear(tables);

    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "CLEAR_HISTORY",
      entity_type: "operations",
      entity_id: selectedGroups.map((group) => group.key).join(","),
      after_json: {
        groups: selectedGroups.map((group) => group.label),
        beforeDate: beforeDate ?? null,
        deleted,
        resynced,
        archiveId: archive.id,
        archiveRows: archive.rowCounts
      }
    });

    res.status(200).json({
      ok: true,
      groups: selectedGroups.map((group) => group.key),
      beforeDate: beforeDate ?? null,
      deleted,
      resynced,
      archiveId: archive.id,
      totalDeleted: Object.values(deleted).reduce((sum, value) => sum + value, 0)
    });
  } catch (error) {
    sendError(res, error);
  }
}
