import { createClient } from "@supabase/supabase-js";
import { assertServerEnv } from "./env.js";
import { permissionScope, type PermissionMap } from "./permissions.js";

export const EXPORTABLE_TABLES = [
  "customers",
  "suppliers",
  "products",
  "product_status_history",
  "price_update_requests",
  "price_update_request_items",
  "price_edit_logs",
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
  "inventory_adjustment_requests",
  "inventory_adjustment_request_items",
  "inventory_edit_logs",
  "cashbook_entries",
  "audit_logs",
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

type ReadActor = {
  id: string;
  permissions: PermissionMap;
};

const TABLE_READ_PERMISSION: Partial<Record<ExportableTable, string>> = {
  customers: "customers.view",
  products: "products.view",
  product_status_history: "products.view",
  price_update_requests: "orders.price_override",
  price_update_request_items: "orders.price_override",
  price_edit_logs: "orders.price_override",
  warehouses: "inventory.view",
  inventory_balances: "inventory.view",
  inventory_transactions: "inventory.manage",
  inventory_adjustment_requests: "inventory.manage",
  inventory_adjustment_request_items: "inventory.manage",
  inventory_edit_logs: "inventory.manage",
  sales_orders: "orders.view",
  sales_order_items: "orders.view",
  receipts: "finance.view",
  payments: "finance.view",
  customer_debt_ledger: "finance.view",
  order_debts: "orders.view",
  receipt_allocations: "finance.view",
  debt_assignments: "finance.view",
  debt_reminders: "finance.view",
  debt_reminder_logs: "finance.view",
  payment_promises: "finance.view",
  customer_contacts: "customers.view",
  suppliers: "inventory.manage",
  purchase_orders: "inventory.manage",
  purchase_order_items: "inventory.manage",
  supplier_debt_ledger: "finance.view",
  cashbook_entries: "finance.view",
  audit_logs: "settings.manage",
  import_batches: "data.import",
  import_errors: "data.import"
};

async function fetchOwnedRows(table: ExportableTable, actorId: string) {
  const supabase = getSupabaseAdmin();
  if (table === "customers") {
    const { data, error } = await supabase.from("customers").select("*").eq("assigned_sale_id", actorId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  if (table === "sales_orders") {
    const { data, error } = await supabase.from("sales_orders").select("*").eq("sale_id", actorId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  if (table === "sales_order_items") {
    const { data: orders, error: orderError } = await supabase.from("sales_orders").select("id").eq("sale_id", actorId);
    if (orderError) throw new Error(orderError.message);
    const orderIds = (orders ?? []).map((row) => row.id);
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase.from("sales_order_items").select("*").in("order_id", orderIds).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  if (table === "order_debts") {
    const { data, error } = await supabase.from("order_debts").select("*").eq("sale_id", actorId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return [];
}

export async function fetchTableRows(table: ExportableTable, actor?: ReadActor) {
  const supabase = getSupabaseAdmin();
  const permission = TABLE_READ_PERMISSION[table];
  const configuredScope = permission && actor ? permissionScope(actor.permissions, permission) : "all";
  // Departments are not modeled yet. Until they are, treat them as own data to fail closed.
  const effectiveScope = configuredScope === "department" ? "own" : configuredScope;
  if (effectiveScope === "none") {
    const error = new Error("User does not have permission for this data.");
    error.name = "FORBIDDEN";
    throw error;
  }
  if (effectiveScope === "own" && actor) return fetchOwnedRows(table, actor.id);
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}
