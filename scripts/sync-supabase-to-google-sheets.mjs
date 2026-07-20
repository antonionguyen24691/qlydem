import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

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

function toSheetValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

async function ensureSheet(title) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === title);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }]
    }
  });
}

async function replaceSheetRows(sheetName, rows) {
  await ensureSheet(sheetName);
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const values = rows.length
    ? [headers, ...rows.map((row) => headers.map((header) => toSheetValue(row[header])))]
    : [["empty"]];

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetName}'!A:ZZ` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values }
  });
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

const synced = [];
for (const table of tables) {
  const rows = await fetchAllRows(table);
  await replaceSheetRows(table, rows);
  synced.push({ table, rows: rows.length });
}

await replaceSheetRows("backup_log", [{
  synced_at: new Date().toISOString(),
  tables: tables.join(","),
  result_json: JSON.stringify(synced)
}]);

console.log(JSON.stringify({ ok: true, synced, syncedAt: new Date().toISOString() }, null, 2));
