import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { sheetNameVi, columnLabelVi } from "./pmql-sheet-locale.mjs";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local", quiet: true });

const DEFAULT_TABLES = [
  "customers",
  "suppliers",
  "products",
  "product_status_history",
  "price_update_requests",
  "price_update_request_items",
  "price_edit_logs",
  "warehouses",
  "inventory_balances",
  "product_lots",
  "inventory_lot_balances",
  "sales_orders",
  "sales_order_items",
  "purchase_orders",
  "purchase_order_items",
  "receipts",
  "payments",
  "customer_debt_ledger",
  "order_debts",
  "receipt_allocations",
  "debt_assignments",
  "debt_reminders",
  "debt_reminder_logs",
  "payment_promises",
  "customer_contacts",
  "supplier_debt_ledger",
  "cashbook_entries",
  "inventory_transactions",
  "inventory_adjustment_requests",
  "inventory_adjustment_request_items",
  "inventory_edit_logs",
  "audit_logs",
  "import_batches",
  "import_errors"
];

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const tables = (process.argv[2] || process.env.PMQL_SYNC_TABLES || DEFAULT_TABLES.join(","))
  .split(",")
  .map((table) => table.trim())
  .filter(Boolean);

if (!supabaseUrl || !serviceRoleKey) throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
if (!spreadsheetId || !clientEmail || !privateKey) {
  throw new Error("Thiếu GOOGLE_SHEETS_SPREADSHEET_ID hoặc Google service account env.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});
await auth.authorize();
const sheets = google.sheets({ version: "v4", auth });

// Google Sheets giới hạn 50.000 ký tự/ô — audit_logs (before_json/after_json) dễ vượt.
const MAX_CELL_CHARS = 49000;
function clampCell(text) {
  const value = String(text);
  return value.length > MAX_CELL_CHARS ? `${value.slice(0, MAX_CELL_CHARS)}…(đã cắt bớt)` : value;
}

// Ngày giờ: đổi ISO/UTC sang dạng đọc được theo giờ VN (20/07/2026 21:45).
const vnDateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric"
});
const vnTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false
});
// Ngày trước, giờ sau: "21/07/2026 13:21" (Intl vi-VN mặc định đảo ngược lại).
const vnDateTimeFormat = {
  format: (date) => `${vnDateFormat.format(date)} ${vnTimeFormat.format(date)}`
};
function formatMaybeDate(text) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return vnDateTimeFormat.format(date);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return vnDateFormat.format(date);
  }
  return null;
}

// Bản đồ UUID -> tên người/hàng hoá/NCC... để Sheet hiện TÊN thay vì mã băm.
const refLabels = new Map();
async function buildRefLabels() {
  const sources = [
    ["products", "id,code,product_name", (r) => [r.code, r.product_name].filter(Boolean).join(" - ")],
    ["customers", "id,name,code", (r) => r.name || r.code],
    ["suppliers", "id,name,code", (r) => r.name || r.code],
    ["warehouses", "id,name,code", (r) => r.name || r.code],
    ["users", "id,full_name,email", (r) => r.full_name || r.email],
    ["product_lots", "id,lot_code", (r) => r.lot_code],
    ["sales_orders", "id,code", (r) => r.code],
    ["purchase_orders", "id,code", (r) => r.code],
    ["receipts", "id,code", (r) => r.code],
    ["sales_returns", "id,code", (r) => r.code]
  ];
  for (const [table, columns, toLabel] of sources) {
    try {
      const { data, error } = await supabase.from(table).select(columns);
      if (error) continue; // bảng chưa tồn tại thì bỏ qua
      for (const row of data ?? []) {
        const label = toLabel(row);
        if (row.id && label) refLabels.set(row.id, String(label));
      }
    } catch {
      // bỏ qua, vẫn xuất được mã gốc
    }
  }
}

function toSheetValue(value, key = "") {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return clampCell(JSON.stringify(value));
  if (typeof value === "string") {
    // Cột khoá ngoại (*_id) -> đổi sang tên đọc được
    if (/(_id|^source_id|^entity_id)$/.test(key) && refLabels.has(value)) return refLabels.get(value);
    const asDate = formatMaybeDate(value);
    if (asDate) return asDate;
    return clampCell(value);
  }
  return value;
}

// Gom mọi lần ghi thành BATCH: Google Sheets giới hạn 60 lượt ghi/phút/user,
// ghi từng tab (clear + update + get) sẽ vượt quota ngay với ~39 bảng.
const pendingWrites = []; // [{ sheetName, values }]

function buildSheetValues(rows) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return rows.length
    ? [headers.map((header) => columnLabelVi(header)), ...rows.map((row) => headers.map((header) => toSheetValue(row[header], header)))]
    : [["(trống)"]];
}

function queueSheetRows(sheetName, rows) {
  pendingWrites.push({ sheetName, values: buildSheetValues(rows) });
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function flushWrites() {
  // 1) Tạo các tab còn thiếu — 1 lượt đọc + 1 lượt ghi
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((spreadsheet.data.sheets ?? []).map((sheet) => sheet.properties?.title));
  const missing = pendingWrites.map((item) => item.sheetName).filter((name) => !existing.has(name));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }
    });
  }

  // 2) Xoá sạch tất cả tab — 1 lượt ghi
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: pendingWrites.map((item) => `'${item.sheetName}'!A:ZZ`) }
  });

  // 3) Ghi dữ liệu — chia lô để tránh payload quá lớn (vài lượt ghi)
  for (const group of chunk(pendingWrites, 8)) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: group.map((item) => ({ range: `'${item.sheetName}'!A1`, values: item.values }))
      }
    });
  }
}

async function fetchAllRows(table) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

await buildRefLabels();

const synced = [];
const rowsByTable = new Map();
for (const table of tables) {
  const rows = await fetchAllRows(table);
  queueSheetRows(sheetNameVi(table), rows);
  synced.push({ table, rows: rows.length });
  rowsByTable.set(table, rows);
}

// Trang Tổng quan: ghi SỐ THẬT, không dùng công thức.
// Công thức kiểu =MAX(0,COUNTA(...)) lỗi #ERROR! khi bảng tính dùng locale Việt Nam
// (dấu phân cách tham số là ";" chứ không phải ","), nên ghi thẳng giá trị là chắc chắn đúng.
const countOf = (table) => (rowsByTable.get(table) ?? []).length;
const totalDebt = (rowsByTable.get("customers") ?? [])
  .reduce((sum, row) => sum + Number(row.current_debt ?? 0), 0);
const nowLabel = vnDateTimeFormat.format(new Date()).replace(",", "");
queueSheetRows(sheetNameVi("dashboard"), [
  { metric: "Số sản phẩm", value: countOf("products"), updated_at: nowLabel },
  { metric: "Số khách hàng", value: countOf("customers"), updated_at: nowLabel },
  { metric: "Số nhà cung cấp", value: countOf("suppliers"), updated_at: nowLabel },
  { metric: "Số dòng tồn kho", value: countOf("inventory_balances"), updated_at: nowLabel },
  { metric: "Số lô hàng", value: countOf("product_lots"), updated_at: nowLabel },
  { metric: "Số đơn bán", value: countOf("sales_orders"), updated_at: nowLabel },
  { metric: "Số phiếu thu", value: countOf("receipts"), updated_at: nowLabel },
  { metric: "Tổng công nợ khách", value: totalDebt, updated_at: nowLabel },
  { metric: "Sao lưu gần nhất", value: nowLabel, updated_at: nowLabel }
]);

queueSheetRows(sheetNameVi("backup_log"), [{
  synced_at: nowLabel,
  tables: tables.join(","),
  result_json: JSON.stringify(synced)
}]);

await flushWrites();

console.log(JSON.stringify({ ok: true, synced, syncedAt: new Date().toISOString() }, null, 2));
