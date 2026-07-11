import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");

const response = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" }
});
if (!response.ok) throw new Error(`Không đọc được schema production: HTTP ${response.status}`);
const schema = await response.json();
const serialized = JSON.stringify(schema);
const required = [
  "unit_cost_snapshot",
  "adjust_customer_debt_secure",
  "create_supplier_payment_secure",
  "cancel_sales_order_secure",
  "apply_inventory_count_secure"
];
const missing = required.filter((name) => !serialized.includes(name));
if (missing.length > 0) {
  throw new Error(`Production chưa có finance integrity migration: ${missing.join(", ")}`);
}

const readRows = async (table, columns) => {
  const result = await fetch(`${url}/rest/v1/${table}?select=${columns}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!result.ok) throw new Error(`Không đọc được ${table}: HTTP ${result.status}`);
  return result.json();
};
const number = (value) => Number(value || 0);
const [orders, debts, customers, receipts, allocations, balances, transactions] = await Promise.all([
  readRows("sales_orders", "id,customer_id,total_amount,paid_amount,debt_amount,status"),
  readRows("order_debts", "id,order_id,customer_id,original_amount,paid_amount,remaining_amount,status"),
  readRows("customers", "id,current_debt"),
  readRows("receipts", "id,amount"),
  readRows("receipt_allocations", "receipt_id,amount"),
  readRows("inventory_balances", "warehouse_id,product_id,quantity_box"),
  readRows("inventory_transactions", "warehouse_id,product_id,stock_after,created_at")
]);
const activeOrders = orders.filter((order) => order.status !== "CANCELLED");
const orderMathErrors = activeOrders.filter((order) => Math.abs(number(order.paid_amount) + number(order.debt_amount) - number(order.total_amount)) > 0.01);
const debtByCustomer = new Map();
for (const debt of debts.filter((item) => item.status !== "CANCELLED")) debtByCustomer.set(debt.customer_id, (debtByCustomer.get(debt.customer_id) || 0) + number(debt.remaining_amount));
const customerDebtErrors = customers.filter((customer) => Math.abs(number(customer.current_debt) - (debtByCustomer.get(customer.id) || 0)) > 0.01);
const allocationByReceipt = new Map();
for (const allocation of allocations) allocationByReceipt.set(allocation.receipt_id, (allocationByReceipt.get(allocation.receipt_id) || 0) + number(allocation.amount));
const receiptErrors = receipts.filter((receipt) => Math.abs(number(receipt.amount) - (allocationByReceipt.get(receipt.id) || 0)) > 0.01);
const latestStock = new Map();
for (const transaction of [...transactions].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
  latestStock.set(`${transaction.warehouse_id}:${transaction.product_id}`, number(transaction.stock_after));
}
const stockErrors = balances.filter((balance) => {
  const row = latestStock.get(`${balance.warehouse_id}:${balance.product_id}`);
  return row !== undefined && Math.abs(number(balance.quantity_box) - row) > 0.01;
});
const integrityErrors = {
  orderMath: orderMathErrors.length,
  customerDebt: customerDebtErrors.length,
  receiptAllocation: receiptErrors.length,
  inventoryBalance: stockErrors.length
};
if (Object.values(integrityErrors).some((count) => count > 0)) {
  throw new Error(`Production finance data mismatch: ${JSON.stringify(integrityErrors)}`);
}
console.log(`Production finance integrity: OK (${activeOrders.length} active orders, ${debts.length} debts, ${receipts.length} receipts, ${balances.length} stock balances)`);
