/**
 * PMQL MasterScript
 *
 * Cach dung nhanh:
 * 1. Vao https://script.google.com tao Apps Script moi, hoac Extensions -> Apps Script trong Google Sheets.
 * 2. Dan toan bo file nay vao Code.gs.
 * 3. Chay PMQL_createBackupSpreadsheet() de tao file Google Sheets backup moi.
 *    Hoac chay PMQL_setupCurrentSpreadsheet() neu dang mo san mot file Google Sheets.
 * 4. Copy Spreadsheet ID dua vao Vercel env GOOGLE_SHEETS_SPREADSHEET_ID.
 */

const PMQL_SPREADSHEET_NAME = "PMQL Supabase Backup";
const PMQL_CHANGE_INBOX = "PMQL_change_inbox";
const PMQL_CHANGE_INBOX_HEADERS = [
  "action", "entity", "code", "field", "value", "expected_updated_at", "note",
  "submission_status", "submitted_at", "result"
];

const PMQL_TABLES = [
  {
    name: "dashboard",
    headers: ["metric", "value", "updated_at"],
    frozenRows: 1
  },
  {
    name: "backup_log",
    headers: ["synced_at", "tables", "result_json", "status", "note"],
    frozenRows: 1
  },
  {
    name: "customers",
    headers: [
      "id", "code", "name", "short_name", "phone", "address", "tax_code", "customer_group",
      "assigned_sale_id", "credit_limit", "credit_days", "status", "note", "last_order_at",
      "total_revenue", "current_debt", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "suppliers",
    headers: [
      "id", "code", "name", "short_name", "phone", "address", "tax_code", "contact_person",
      "payment_terms", "status", "note", "current_payable", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "products",
    headers: [
      "id", "code", "invoice_name", "product_name", "product_type", "parent_product_id",
      "category", "brand", "size", "unit", "m2_per_box", "pieces_per_box", "price_by_m2",
      "sell_price_box_vat", "cost_price", "vat_rate", "barcode", "status",
      "lifecycle_status", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "warehouses",
    headers: ["id", "code", "name", "address", "status", "created_at", "updated_at"],
    frozenRows: 1
  },
  {
    name: "inventory_balances",
    headers: [
      "id", "warehouse_id", "product_id", "quantity_box", "quantity_piece",
      "min_stock_level", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "inventory_transactions",
    headers: [
      "id", "warehouse_id", "product_id", "source_type", "source_id", "quantity_change",
      "stock_after", "note", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "sales_orders",
    headers: [
      "id", "code", "order_date", "customer_id", "sale_id", "subtotal", "discount_amount",
      "vat_amount", "total_amount", "paid_amount", "debt_amount", "payment_method",
      "status", "note", "printed_at", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "sales_order_items",
    headers: [
      "id", "order_id", "product_id", "product_code", "product_name", "unit",
      "quantity", "unit_price", "discount_amount", "vat_rate", "line_total", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "receipts",
    headers: [
      "id", "code", "customer_id", "order_id", "amount", "payment_method",
      "note", "created_by", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "payments",
    headers: [
      "id", "code", "supplier_id", "purchase_order_id", "amount", "payment_method",
      "note", "created_by", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "customer_debt_ledger",
    headers: [
      "id", "customer_id", "order_id", "source_type", "source_id", "debit", "credit",
      "balance_after", "due_date", "status", "note", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "order_debts",
    headers: [
      "id", "order_id", "customer_id", "sale_id", "original_amount", "paid_amount",
      "remaining_amount", "due_date", "assigned_to", "status", "closed_at", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "receipt_allocations",
    headers: [
      "id", "receipt_id", "order_debt_id", "order_id", "customer_id",
      "amount", "allocated_by", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "debt_reminders",
    headers: [
      "id", "customer_id", "order_debt_id", "assigned_to", "remind_at",
      "channel", "message", "status", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "debt_reminder_logs",
    headers: [
      "id", "reminder_id", "sent_at", "channel", "recipient", "status",
      "response_json", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "payment_promises",
    headers: [
      "id", "customer_id", "order_debt_id", "promised_amount", "promised_date",
      "status", "note", "created_by", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "customer_contacts",
    headers: [
      "id", "customer_id", "name", "phone", "email", "role", "note", "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "supplier_debt_ledger",
    headers: [
      "id", "supplier_id", "purchase_order_id", "source_type", "source_id",
      "debit", "credit", "balance_after", "status", "note", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "cashbook_entries",
    headers: [
      "id", "code", "account_type", "direction", "source_type", "source_id",
      "amount", "payment_method", "note", "created_by", "created_at"
    ],
    frozenRows: 1
  },
  {
    name: "import_batches",
    headers: [
      "id", "entity_type", "file_name", "total_rows", "success_rows",
      "failed_rows", "status", "created_by", "created_at", "completed_at"
    ],
    frozenRows: 1
  },
  {
    name: "import_errors",
    headers: [
      "id", "batch_id", "row_number", "entity_type", "row_json", "error_message", "created_at"
    ],
    frozenRows: 1
  },
  { name: "product_status_history", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "price_update_requests", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "price_update_request_items", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "price_edit_logs", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "purchase_orders", headers: ["id", "code", "created_at", "updated_at"], frozenRows: 1 },
  { name: "purchase_order_items", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "debt_assignments", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "inventory_adjustment_requests", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "inventory_adjustment_request_items", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "inventory_edit_logs", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "audit_logs", headers: ["id", "created_at"], frozenRows: 1 }
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PMQL")
    .addItem("Setup current spreadsheet", "PMQL_setupCurrentSpreadsheet")
    .addItem("Create backup spreadsheet", "PMQL_createBackupSpreadsheet")
    .addItem("Refresh dashboard formulas", "PMQL_refreshDashboard")
    .addItem("Submit change inbox to PMQL", "PMQL_submitChangeInbox")
    .addToUi();
}

function PMQL_createBackupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.create(PMQL_SPREADSHEET_NAME + " " + PMQL_today());
  PMQL_setupSpreadsheet_(spreadsheet);
  Logger.log("Spreadsheet ID: " + spreadsheet.getId());
  Logger.log("URL: " + spreadsheet.getUrl());
  return {
    id: spreadsheet.getId(),
    url: spreadsheet.getUrl()
  };
}

function PMQL_setupCurrentSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PMQL_setupSpreadsheet_(spreadsheet);
  SpreadsheetApp.getUi().alert("PMQL backup sheets da duoc tao/cap nhat.\nSpreadsheet ID: " + spreadsheet.getId());
}

function PMQL_setupSpreadsheet_(spreadsheet) {
  PMQL_TABLES.forEach(function(table) {
    const sheet = PMQL_getOrCreateSheet_(spreadsheet, table.name);
    PMQL_setupSheet_(sheet, table.headers, table.frozenRows || 1);
  });
  PMQL_setupSheet_(PMQL_getOrCreateSheet_(spreadsheet, PMQL_CHANGE_INBOX), PMQL_CHANGE_INBOX_HEADERS, 1);

  PMQL_refreshDashboardFor_(spreadsheet);
  PMQL_deleteDefaultSheetIfEmpty_(spreadsheet);
}

function PMQL_getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function PMQL_setupSheet_(sheet, headers, frozenRows) {
  sheet.clearFormats();
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(frozenRows);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#006B68")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.autoResizeColumns(1, headers.length);

  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(1, 1, Math.max(2, sheet.getMaxRows()), headers.length).createFilter();
}

function PMQL_refreshDashboard() {
  PMQL_refreshDashboardFor_(SpreadsheetApp.getActiveSpreadsheet());
}

function PMQL_refreshDashboardFor_(spreadsheet) {
  const sheet = PMQL_getOrCreateSheet_(spreadsheet, "dashboard");
  PMQL_setupSheet_(sheet, ["metric", "value", "updated_at"], 1);
  const nowFormula = '=TEXT(NOW(),"yyyy-mm-dd hh:mm:ss")';
  const rows = [
    ["products_count", '=MAX(0,COUNTA(products!A:A)-1)', nowFormula],
    ["customers_count", '=MAX(0,COUNTA(customers!A:A)-1)', nowFormula],
    ["suppliers_count", '=MAX(0,COUNTA(suppliers!A:A)-1)', nowFormula],
    ["inventory_rows", '=MAX(0,COUNTA(inventory_balances!A:A)-1)', nowFormula],
    ["sales_orders_count", '=MAX(0,COUNTA(sales_orders!A:A)-1)', nowFormula],
    ["receipts_count", '=MAX(0,COUNTA(receipts!A:A)-1)', nowFormula],
    ["customer_debt_total", '=IFERROR(SUM(customers!P:P),0)', nowFormula],
    ["last_backup", '=IFERROR(MAX(backup_log!A:A),"")', nowFormula]
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, 3);
}

function PMQL_deleteDefaultSheetIfEmpty_(spreadsheet) {
  const defaultSheet = spreadsheet.getSheetByName("Sheet1") || spreadsheet.getSheetByName("Trang tính1");
  if (!defaultSheet || spreadsheet.getSheets().length <= 1) return;
  const values = defaultSheet.getDataRange().getValues();
  const hasData = values.some(function(row) {
    return row.some(function(cell) {
      return String(cell || "").trim() !== "";
    });
  });
  if (!hasData) spreadsheet.deleteSheet(defaultSheet);
}

function PMQL_today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * Cấu hình một lần tại Project Settings > Script properties:
 * - PMQL_API_BASE_URL: https://your-app.vercel.app
 * - PMQL_SYNC_SECRET: trùng với GOOGLE_SHEETS_SYNC_SECRET trên Vercel
 *
 * Chỉ gửi các dòng action = SEND. Không sửa trực tiếp các tab mirror;
 * PMQL sẽ kiểm tra mã, phiên bản dữ liệu và bắt buộc admin duyệt trước khi áp dụng.
 */
function PMQL_submitChangeInbox() {
  const properties = PropertiesService.getScriptProperties();
  const baseUrl = String(properties.getProperty("PMQL_API_BASE_URL") || "").replace(/\/$/, "");
  const secret = String(properties.getProperty("PMQL_SYNC_SECRET") || "");
  if (!baseUrl || !secret) throw new Error("Thiếu PMQL_API_BASE_URL hoặc PMQL_SYNC_SECRET trong Script properties.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PMQL_CHANGE_INBOX);
  if (!sheet) throw new Error("Không tìm thấy tab " + PMQL_CHANGE_INBOX + ". Hãy chạy PMQL_setupCurrentSpreadsheet().");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert("Chưa có dòng thay đổi để gửi.");
    return;
  }
  const changes = [];
  const rowIndexes = [];
  values.slice(1).forEach(function(row, index) {
    if (String(row[0] || "").trim().toUpperCase() !== "SEND") return;
    changes.push({
      source_row: index + 2,
      entity: String(row[1] || "").trim(),
      code: String(row[2] || "").trim(),
      field: String(row[3] || "").trim(),
      value: row[4],
      expected_updated_at: String(row[5] || "").trim(),
      note: String(row[6] || "").trim()
    });
    rowIndexes.push(index + 2);
  });
  if (!changes.length) {
    SpreadsheetApp.getUi().alert("Không có dòng action = SEND.");
    return;
  }
  const response = UrlFetchApp.fetch(baseUrl + "/api/data/sheet-inbox", {
    method: "post",
    contentType: "application/json",
    headers: { "X-PMQL-Sync-Secret": secret },
    payload: JSON.stringify({ changes: changes }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const payload = JSON.parse(response.getContentText() || "{}");
  const now = new Date();
  rowIndexes.forEach(function(rowIndex, index) {
    const error = (payload.rejected || []).find(function(item) { return Number(item.row) === index + 2; });
    sheet.getRange(rowIndex, 8, 1, 3).setValues([[
      error ? "REJECTED" : (status >= 200 && status < 300 ? "PENDING_APPROVAL" : "FAILED"),
      now,
      error ? error.error : (payload.error || "Đã gửi vào hàng chờ duyệt của PMQL")
    ]]);
  });
  if (status < 200 || status >= 300) throw new Error(payload.error || "Không gửi được inbox về PMQL.");
  SpreadsheetApp.getUi().alert("Đã gửi " + (payload.accepted || 0) + " thay đổi vào hàng chờ duyệt. Hãy duyệt trong PMQL.");
}
