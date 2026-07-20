// Bản đồ Việt hóa Google Sheets cho script đồng bộ (node).
// ⚠️ Giữ ĐỒNG NHẤT với api/_lib/sheetLocale.ts và PMQL_MasterScript.gs.

export const SHEET_NAME_VI = {
  dashboard: "Tổng quan",
  backup_log: "Nhật ký sao lưu",
  customers: "Khách hàng",
  suppliers: "Nhà cung cấp",
  products: "Sản phẩm",
  product_status_history: "Lịch sử trạng thái SP",
  price_update_requests: "Yêu cầu đổi giá",
  price_update_request_items: "Chi tiết yêu cầu đổi giá",
  price_edit_logs: "Nhật ký sửa giá",
  warehouses: "Kho",
  inventory_balances: "Tồn kho",
  product_lots: "Lô hàng",
  inventory_lot_balances: "Tồn kho theo lô",
  sales_orders: "Đơn bán",
  sales_order_items: "Chi tiết đơn bán",
  purchase_orders: "Đơn nhập",
  purchase_order_items: "Chi tiết đơn nhập",
  receipts: "Phiếu thu",
  payments: "Phiếu chi NCC",
  customer_debt_ledger: "Sổ công nợ khách",
  order_debts: "Công nợ đơn",
  receipt_allocations: "Phân bổ phiếu thu",
  debt_assignments: "Phân công thu nợ",
  debt_reminders: "Nhắc nợ",
  debt_reminder_logs: "Nhật ký nhắc nợ",
  payment_promises: "Hẹn thanh toán",
  customer_contacts: "Liên hệ khách",
  supplier_debt_ledger: "Sổ công nợ NCC",
  inventory_transactions: "Giao dịch kho",
  inventory_adjustment_requests: "Yêu cầu điều chỉnh kho",
  inventory_adjustment_request_items: "Chi tiết điều chỉnh kho",
  inventory_edit_logs: "Nhật ký sửa kho",
  cashbook_entries: "Sổ quỹ",
  sales_returns: "Phiếu trả hàng",
  sales_return_items: "Chi tiết trả hàng",
  customer_credit_ledger: "Sổ số dư khách",
  audit_logs: "Nhật ký hệ thống",
  import_batches: "Lô import",
  import_errors: "Lỗi import"
};

export const COLUMN_LABEL_VI = {
  id: "ID", code: "Mã", name: "Tên", short_name: "Tên ngắn", phone: "Điện thoại", email: "Email",
  address: "Địa chỉ", tax_code: "Mã số thuế", customer_group: "Nhóm khách", assigned_sale_id: "NV phụ trách",
  credit_limit: "Hạn mức nợ", credit_days: "Số ngày nợ", credit_balance: "Số dư", current_debt: "Công nợ hiện tại",
  current_payable: "Phải trả hiện tại", total_revenue: "Tổng doanh thu", last_order_at: "Đơn gần nhất",
  status: "Trạng thái", lifecycle_status: "Vòng đời", note: "Ghi chú", created_at: "Ngày tạo", updated_at: "Ngày cập nhật",
  contact_person: "Người liên hệ", payment_terms: "Điều khoản TT", invoice_name: "Tên trên HĐ", product_name: "Tên sản phẩm",
  product_type: "Loại hàng", parent_product_id: "SP cha", category: "Danh mục", brand: "Thương hiệu", size: "Kích thước",
  unit: "ĐVT", m2_per_box: "M2/hộp", pieces_per_box: "Viên/hộp", price_by_m2: "Giá theo M2", sell_price_box_vat: "Giá hộp VAT",
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

export function sheetNameVi(table) {
  return SHEET_NAME_VI[table] ?? table;
}

export function columnLabelVi(key) {
  return COLUMN_LABEL_VI[key] ?? key;
}
