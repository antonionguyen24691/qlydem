import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const migrationFile = "supabase/migrations/20260711_finance_integrity_hardening.sql";

if (!existsSync(resolve(root, migrationFile))) {
  throw new Error(`Finance integrity verification failed: missing ${migrationFile}`);
}

const migration = read(migrationFile);
const dataApi = read("api/data/[table].ts");
const customerPage = read("src/pages/Customers.tsx");
const financePage = read("src/pages/Finance.tsx");
const expensesPage = read("src/pages/Expenses.tsx");

const required = [
  [migration, "unit_cost_snapshot", "historical COGS snapshot"],
  [migration, "adjust_customer_debt_secure", "customer debt adjustment RPC"],
  [migration, "create_supplier_payment_secure", "supplier payment RPC"],
  [migration, "cancel_sales_order_secure", "sales cancellation RPC"],
  [migration, "apply_inventory_count_secure", "atomic inventory count RPC"],
  [dataApi, 'rpc("adjust_customer_debt_secure"', "customer debt API RPC"],
  [dataApi, 'rpc("create_supplier_payment_secure"', "supplier payment API RPC"],
  [dataApi, 'rpc("cancel_sales_order_secure"', "order cancellation API RPC"],
  [dataApi, 'rpc("apply_inventory_count_secure"', "inventory count API RPC"],
  [financePage, '["RECEIPT", "SALES_ORDER"].includes', "finance collected-source filter"],
  [expensesPage, "unitCostSnapshot", "report historical COGS mapping"]
];

const missing = required
  .filter(([source, expected]) => !source.includes(expected))
  .map(([, , label]) => label);

if (customerPage.includes('value={form.oldDebt')) {
  missing.push("customer form still edits debt directly");
}
if (missing.length > 0) {
  throw new Error(`Finance integrity verification failed: ${missing.join(", ")}`);
}

console.log("Finance integrity contract: OK");
