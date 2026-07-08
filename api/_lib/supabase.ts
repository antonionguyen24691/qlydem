import { createClient } from "@supabase/supabase-js";
import { assertServerEnv } from "./env.js";

export const EXPORTABLE_TABLES = [
  "customers",
  "suppliers",
  "products",
  "product_status_history",
  "warehouses",
  "inventory_balances",
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
  "inventory_transactions",
  "cashbook_entries",
  "import_batches",
  "import_errors"
] as const;

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

export function getSupabaseAdmin() {
  assertServerEnv();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

export function parseTables(input?: string) {
  if (!input) return [...EXPORTABLE_TABLES];
  const requested = input.split(",").map((table) => table.trim()).filter(Boolean);
  const invalid = requested.filter((table) => !EXPORTABLE_TABLES.includes(table as ExportableTable));
  if (invalid.length > 0) {
    throw new Error(`Unsupported table(s): ${invalid.join(", ")}`);
  }
  return requested as ExportableTable[];
}

export async function fetchTableRows(table: ExportableTable) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}
