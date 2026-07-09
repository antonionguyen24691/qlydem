import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const migration = read("supabase/migrations/20260710_secure_transactions_rls.sql");
const orderApi = read("api/orders/create.ts");
const receiptApi = read("api/receipts/create.ts");
const auth = read("api/_lib/auth.ts");

const required = [
  [migration, "create_sales_order_secure", "secure order RPC"],
  [migration, "create_receipt_secure", "secure receipt RPC"],
  [migration, "pg_advisory_xact_lock", "idempotency lock"],
  [migration, "enable row level security", "RLS enablement"],
  [migration, "history_clear_backups", "clear-history archive"],
  [orderApi, 'rpc("create_sales_order_secure"', "order API RPC call"],
  [receiptApi, 'rpc("create_receipt_secure"', "receipt API RPC call"],
  [orderApi, '"idempotency-key"', "order idempotency header"],
  [receiptApi, '"idempotency-key"', "receipt idempotency header"],
  [auth, "User is not provisioned in CRM users table.", "fail-closed user provisioning"]
];

const missing = required.filter(([source, expected]) => !source.includes(expected)).map(([, , label]) => label);
if (missing.length > 0) {
  throw new Error(`Hardening verification failed: missing ${missing.join(", ")}`);
}

if (auth.includes("count === 0")) {
  throw new Error("Hardening verification failed: first-login ADMIN bootstrap still exists.");
}

console.log("Security hardening contract: OK");
