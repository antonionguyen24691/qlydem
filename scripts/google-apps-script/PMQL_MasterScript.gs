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

const PMQL_SPREADSHEET_NAME = "PMQL Sao lưu Supabase";
const PMQL_CHANGE_INBOX = "Hàng chờ duyệt";
const PMQL_CHANGE_INBOX_HEADERS = [
  "Hành động", "Đối tượng", "Mã", "Trường", "Giá trị", "Bản cập nhật kỳ vọng", "Ghi chú",
  "Trạng thái gửi", "Thời điểm gửi", "Kết quả"
];

// Bản đồ Việt hóa — ĐỒNG NHẤT với api/_lib/sheetLocale.ts và scripts/pmql-sheet-locale.mjs.
const PMQL_SHEET_NAME_VI = {
  dashboard: "Tổng quan", backup_log: "Nhật ký sao lưu", customers: "Khách hàng", suppliers: "Nhà cung cấp",
  products: "Sản phẩm", product_status_history: "Lịch sử trạng thái SP", price_update_requests: "Yêu cầu đổi giá",
  price_update_request_items: "Chi tiết yêu cầu đổi giá", price_edit_logs: "Nhật ký sửa giá", warehouses: "Kho",
  inventory_balances: "Tồn kho", product_lots: "Lô hàng", inventory_lot_balances: "Tồn kho theo lô",
  sales_orders: "Đơn bán", sales_order_items: "Chi tiết đơn bán", purchase_orders: "Đơn nhập",
  purchase_order_items: "Chi tiết đơn nhập", receipts: "Phiếu thu", payments: "Phiếu chi NCC",
  customer_debt_ledger: "Sổ công nợ khách", order_debts: "Công nợ đơn", receipt_allocations: "Phân bổ phiếu thu",
  debt_assignments: "Phân công thu nợ", debt_reminders: "Nhắc nợ", debt_reminder_logs: "Nhật ký nhắc nợ",
  payment_promises: "Hẹn thanh toán", customer_contacts: "Liên hệ khách", supplier_debt_ledger: "Sổ công nợ NCC",
  inventory_transactions: "Giao dịch kho", inventory_adjustment_requests: "Yêu cầu điều chỉnh kho",
  inventory_adjustment_request_items: "Chi tiết điều chỉnh kho", inventory_edit_logs: "Nhật ký sửa kho",
  cashbook_entries: "Sổ quỹ", sales_returns: "Phiếu trả hàng", sales_return_items: "Chi tiết trả hàng",
  customer_credit_ledger: "Sổ số dư khách", audit_logs: "Nhật ký hệ thống", import_batches: "Lô import",
  import_errors: "Lỗi import"
};

const PMQL_COLUMN_LABEL_VI = {
  id: "ID", code: "Mã", name: "Tên", short_name: "Tên ngắn", phone: "Điện thoại", email: "Email", address: "Địa chỉ",
  tax_code: "Mã số thuế", customer_group: "Nhóm khách", assigned_sale_id: "NV phụ trách", credit_limit: "Hạn mức nợ",
  credit_days: "Số ngày nợ", credit_balance: "Số dư", current_debt: "Công nợ hiện tại", current_payable: "Phải trả hiện tại",
  total_revenue: "Tổng doanh thu", last_order_at: "Đơn gần nhất", status: "Trạng thái", lifecycle_status: "Vòng đời",
  note: "Ghi chú", created_at: "Ngày tạo", updated_at: "Ngày cập nhật", contact_person: "Người liên hệ",
  payment_terms: "Điều khoản TT", invoice_name: "Tên trên HĐ", product_name: "Tên sản phẩm", product_type: "Loại hàng",
  parent_product_id: "SP cha", category: "Danh mục", brand: "Thương hiệu", size: "Kích thước", unit: "ĐVT",
  m2_per_box: "M2/hộp", pieces_per_box: "Viên/hộp", price_by_m2: "Giá theo M2", sell_price_box_vat: "Giá hộp VAT",
  cost_price: "Giá vốn", vat_rate: "VAT %", barcode: "Barcode", track_lots: "Quản lý lô", warehouse_id: "Kho",
  product_id: "Sản phẩm", quantity_box: "SL hộp", quantity_piece: "SL lẻ", min_stock_level: "Tồn tối thiểu",
  lot_id: "Lô", lot_code: "Số lô", supplier_id: "Nhà cung cấp", purchase_id: "Đơn nhập", received_date: "Ngày nhập",
  unit_cost: "Giá vốn", color_note: "Màu/mẻ", quality_note: "Chất lượng", image_urls: "Ảnh", order_id: "Đơn hàng",
  order_date: "Ngày đơn", customer_id: "Khách hàng", sale_id: "NV bán", subtotal: "Tạm tính", discount_amount: "Giảm giá",
  vat_amount: "Tiền VAT", total_amount: "Tổng tiền", paid_amount: "Đã trả", debt_amount: "Còn nợ", payable_amount: "Phải trả",
  payment_method: "Phương thức TT", printed_at: "Ngày in", returned_amount: "Đã trả hàng", product_code: "Mã hàng",
  quantity: "Số lượng", unit_price: "Đơn giá", line_total: "Thành tiền", unit_cost_snapshot: "Giá vốn ghi nhận",
  purchase_date: "Ngày nhập", amount: "Số tiền", receipt_date: "Ngày thu", created_by: "Người tạo", payment_date: "Ngày chi",
  source_type: "Loại nguồn", source_id: "Mã nguồn", debit: "Ghi nợ", credit: "Ghi có", balance_after: "Số dư sau",
  due_date: "Hạn", original_amount: "Số gốc", remaining_amount: "Còn lại", assigned_to: "Phụ trách",
  last_reminded_at: "Nhắc gần nhất", next_reminder_at: "Nhắc kế tiếp", closed_at: "Ngày đóng", receipt_id: "Phiếu thu",
  order_debt_id: "Công nợ đơn", allocated_at: "Ngày phân bổ", allocated_by: "Người phân bổ", reminder_type: "Loại nhắc",
  channel: "Kênh", scheduled_at: "Lịch nhắc", title: "Tiêu đề", message: "Nội dung", reminder_id: "Nhắc nợ",
  sent_at: "Ngày gửi", recipient: "Người nhận", response_json: "Phản hồi", promised_amount: "Số hẹn", promised_date: "Ngày hẹn",
  role: "Vai trò", quantity_change: "Thay đổi SL", stock_after: "Tồn sau", request_type: "Loại yêu cầu",
  requested_by: "Người yêu cầu", approved_by: "Người duyệt", approved_at: "Ngày duyệt", rejected_by: "Người từ chối",
  rejected_at: "Ngày từ chối", old_quantity_box: "SL cũ", new_quantity_box: "SL mới", old_sell_price: "Giá bán cũ",
  new_sell_price: "Giá bán mới", old_cost_price: "Giá vốn cũ", edited_by: "Người sửa", account_type: "Loại tài khoản",
  direction: "Chiều", refund_method: "Cách hoàn", reason_code: "Mã lý do", reason: "Lý do", condition: "Tình trạng",
  refund_cash_amount: "Hoàn tiền mặt", debt_offset_amount: "Cấn nợ", credit_amount: "Vào số dư", entity_type: "Loại đối tượng",
  file_name: "Tên file", total_rows: "Tổng dòng", success_rows: "Dòng thành công", failed_rows: "Dòng lỗi",
  completed_at: "Hoàn tất lúc", batch_id: "Lô import", row_number: "Dòng", row_json: "Dữ liệu dòng", error_message: "Lỗi",
  action: "Hành động", actor_id: "Người thực hiện", entity_id: "Mã đối tượng", before_json: "Trước", after_json: "Sau",
  ip: "IP", metric: "Chỉ số", value: "Giá trị", synced_at: "Đồng bộ lúc", tables: "Bảng", result_json: "Kết quả"
};

function pmqlSheetName_(table) { return PMQL_SHEET_NAME_VI[table] || table; }
function pmqlHeaderLabels_(keys) { return keys.map(function(k) { return PMQL_COLUMN_LABEL_VI[k] || k; }); }

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
    name: "product_lots",
    headers: [
      "id", "product_id", "lot_code", "supplier_id", "purchase_id", "received_date",
      "unit_cost", "color_note", "quality_note", "image_urls", "status", "note",
      "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "inventory_lot_balances",
    headers: [
      "id", "warehouse_id", "product_id", "lot_id", "quantity_box", "quantity_piece",
      "created_at", "updated_at"
    ],
    frozenRows: 1
  },
  {
    name: "inventory_transactions",
    headers: [
      "id", "warehouse_id", "product_id", "lot_id", "source_type", "source_id", "quantity_change",
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
      "quantity", "unit_price", "discount_amount", "vat_rate", "line_total",
      "lot_id", "lot_code", "unit_cost_snapshot", "created_at"
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
  { name: "purchase_order_items", headers: ["id", "purchase_id", "product_id", "product_code", "product_name", "unit", "quantity", "unit_cost", "line_total", "lot_id", "created_at"], frozenRows: 1 },
  { name: "debt_assignments", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "inventory_adjustment_requests", headers: ["id", "created_at", "updated_at"], frozenRows: 1 },
  { name: "inventory_adjustment_request_items", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "inventory_edit_logs", headers: ["id", "created_at"], frozenRows: 1 },
  { name: "audit_logs", headers: ["id", "created_at"], frozenRows: 1 }
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PMQL")
    .addItem("Thiết lập bảng tính hiện tại", "PMQL_setupCurrentSpreadsheet")
    .addItem("Tạo file sao lưu mới", "PMQL_createBackupSpreadsheet")
    .addItem("Làm mới trang Tổng quan", "PMQL_refreshDashboard")
    .addItem("Gửi thay đổi về PMQL", "PMQL_submitChangeInbox")
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
  SpreadsheetApp.getUi().alert("Đã tạo/cập nhật các trang sao lưu PMQL.\nSpreadsheet ID: " + spreadsheet.getId());
}

function PMQL_setupSpreadsheet_(spreadsheet) {
  PMQL_TABLES.forEach(function(table) {
    const sheet = PMQL_getOrCreateSheet_(spreadsheet, pmqlSheetName_(table.name));
    PMQL_setupSheet_(sheet, pmqlHeaderLabels_(table.headers), table.frozenRows || 1);
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
  const sheet = PMQL_getOrCreateSheet_(spreadsheet, pmqlSheetName_("dashboard"));
  PMQL_setupSheet_(sheet, ["Chỉ số", "Giá trị", "Cập nhật lúc"], 1);
  const nowFormula = '=TEXT(NOW(),"yyyy-mm-dd hh:mm:ss")';
  var q = function(table) { return "'" + pmqlSheetName_(table) + "'"; };
  const rows = [
    ["Số sản phẩm", '=MAX(0,COUNTA(' + q("products") + '!A:A)-1)', nowFormula],
    ["Số khách hàng", '=MAX(0,COUNTA(' + q("customers") + '!A:A)-1)', nowFormula],
    ["Số nhà cung cấp", '=MAX(0,COUNTA(' + q("suppliers") + '!A:A)-1)', nowFormula],
    ["Số dòng tồn kho", '=MAX(0,COUNTA(' + q("inventory_balances") + '!A:A)-1)', nowFormula],
    ["Số lô hàng", '=MAX(0,COUNTA(' + q("product_lots") + '!A:A)-1)', nowFormula],
    ["Số đơn bán", '=MAX(0,COUNTA(' + q("sales_orders") + '!A:A)-1)', nowFormula],
    ["Số phiếu thu", '=MAX(0,COUNTA(' + q("receipts") + '!A:A)-1)', nowFormula],
    ["Tổng công nợ khách", '=IFERROR(SUM(' + q("customers") + '!P:P),0)', nowFormula],
    ["Sao lưu gần nhất", '=IFERROR(MAX(' + q("backup_log") + '!A:A),"")', nowFormula]
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
