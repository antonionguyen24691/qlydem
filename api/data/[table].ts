import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { EXPORTABLE_TABLES, fetchTableRows, type ExportableTable } from "../_lib/supabase.js";
import { requireAuth } from "../_lib/auth.js";
import { createCode, getJsonBody, optionalString, toNumber, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

const TABLE_READ_ROLES: Partial<Record<ExportableTable, string[]>> = {
  customers: ["ADMIN", "ACCOUNTANT", "SALE"],
  products: ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"],
  warehouses: ["ADMIN", "WAREHOUSE"],
  inventory_balances: ["ADMIN", "WAREHOUSE", "SALE"],
  inventory_transactions: ["ADMIN", "WAREHOUSE"],
  sales_orders: ["ADMIN", "ACCOUNTANT", "SALE"],
  sales_order_items: ["ADMIN", "ACCOUNTANT", "SALE"],
  receipts: ["ADMIN", "ACCOUNTANT"],
  customer_debt_ledger: ["ADMIN", "ACCOUNTANT"],
  order_debts: ["ADMIN", "ACCOUNTANT", "SALE"],
  receipt_allocations: ["ADMIN", "ACCOUNTANT"],
  cashbook_entries: ["ADMIN", "ACCOUNTANT"],
  suppliers: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  purchase_orders: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  purchase_order_items: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  supplier_debt_ledger: ["ADMIN", "ACCOUNTANT"]
};

function normalizeProductType(value: unknown) {
  const raw = toStringValue(value, "MERCHANDISE").trim().toUpperCase();
  const map: Record<string, string> = {
    RAW: "RAW_MATERIAL",
    RAW_MATERIAL: "RAW_MATERIAL",
    NGUYEN_LIEU: "RAW_MATERIAL",
    "NGUYÊN LIỆU": "RAW_MATERIAL",
    SEMI: "SEMI_FINISHED",
    SEMI_FINISHED: "SEMI_FINISHED",
    BAN_THANH_PHAM: "SEMI_FINISHED",
    "BÁN THÀNH PHẨM": "SEMI_FINISHED",
    FINISHED: "FINISHED",
    THANH_PHAM: "FINISHED",
    "THÀNH PHẨM": "FINISHED",
    MERCHANDISE: "MERCHANDISE",
    HANG_HOA: "MERCHANDISE",
    "HÀNG HÓA": "MERCHANDISE"
  };
  return map[raw] ?? raw;
}

function productPayload(body: Record<string, unknown>) {
  const code = toStringValue(body.code).trim();
  const productName = toStringValue(body.productName ?? body.product_name ?? body.name).trim();
  if (!code || !productName) {
    const error = new Error("Thiếu mã hàng hoặc tên hàng hóa.");
    error.name = "BAD_REQUEST";
    throw error;
  }

  return {
    code,
    product_name: productName,
    invoice_name: optionalString(body.invoiceName ?? body.invoice_name),
    product_type: normalizeProductType(body.productType ?? body.product_type),
    category: optionalString(body.category),
    brand: optionalString(body.brand),
    size: optionalString(body.size),
    unit: toStringValue(body.unit, "HỘP"),
    m2_per_box: toNumber(body.m2PerBox ?? body.m2_per_box),
    pieces_per_box: toNumber(body.piecesPerBox ?? body.pieces_per_box),
    price_by_m2: toNumber(body.priceByM2 ?? body.price_by_m2),
    sell_price_box_vat: toNumber(body.price ?? body.sellPriceBoxVat ?? body.sell_price_box_vat),
    cost_price: toNumber(body.cost ?? body.costPrice ?? body.cost_price),
    vat_rate: toNumber(body.vatRate ?? body.vat_rate),
    barcode: optionalString(body.barcode),
    status: toStringValue(body.status, "ACTIVE").toUpperCase(),
    lifecycle_status: toStringValue(body.lifecycleStatus ?? body.lifecycle_status, "ACTIVE").toUpperCase(),
    updated_at: new Date().toISOString()
  };
}

function customerPayload(body: Record<string, unknown>) {
  const name = toStringValue(body.name).trim();
  if (!name) {
    const error = new Error("Thiếu tên khách hàng.");
    error.name = "BAD_REQUEST";
    throw error;
  }

  return {
    code: toStringValue(body.code, createCode("KH")).trim(),
    name,
    short_name: optionalString(body.shortName ?? body.short_name) ?? name,
    phone: optionalString(body.phone),
    address: optionalString(body.address),
    tax_code: optionalString(body.taxCode ?? body.tax_code),
    customer_group: toStringValue(body.customerGroup ?? body.customer_group, "RETAIL"),
    credit_limit: toNumber(body.creditLimit ?? body.credit_limit),
    credit_days: toNumber(body.creditDays ?? body.credit_days),
    current_debt: toNumber(body.oldDebt ?? body.currentDebt ?? body.current_debt),
    status: toStringValue(body.status, "ACTIVE").toUpperCase(),
    note: optionalString(body.note),
    updated_at: new Date().toISOString()
  };
}

async function saveCustomer(req: ApiRequest, res: ApiResponse) {
  const actor = await requireAuth(req, ["ADMIN", "ACCOUNTANT"]);
  const body = getJsonBody(req);
  const supabase = getSupabaseAdmin();
  const payload = customerPayload(body);

  const existingId = optionalString(body.id);
  const query = existingId
    ? supabase.from("customers").update(payload).eq("id", existingId).select("*").single()
    : supabase.from("customers").upsert(payload, { onConflict: "code" }).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: existingId ? "UPDATE" : "UPSERT",
    entity_type: "customer",
    entity_id: data.id,
    after_json: data
  });

  await bestEffortSyncTables(["customers"]);
  res.status(200).json({ ok: true, customer: data });
}

async function ensureWarehouse(code = "KHO-CHINH") {
  const supabase = getSupabaseAdmin();
  const normalizedCode = code.trim() || "KHO-CHINH";
  const { data: existing, error: findError } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", normalizedCode)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ code: normalizedCode, name: normalizedCode, status: "ACTIVE" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function saveProduct(req: ApiRequest, res: ApiResponse) {
  const actor = await requireAuth(req, ["ADMIN", "WAREHOUSE"]);
  const body = getJsonBody(req);
  const supabase = getSupabaseAdmin();
  const payload = productPayload(body);

  const { data, error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "code" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const warehouseId = await ensureWarehouse(toStringValue(body.warehouseCode, "KHO-CHINH"));
  const openingStock = toNumber(body.stock ?? body.openingStock ?? 0);
  const minStockLevel = toNumber(body.minStockLevel ?? 0);
  await supabase.from("inventory_balances").upsert({
    warehouse_id: warehouseId,
    product_id: data.id,
    quantity_box: openingStock,
    quantity_piece: 0,
    min_stock_level: minStockLevel,
    updated_at: new Date().toISOString()
  }, { onConflict: "warehouse_id,product_id" });

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "UPSERT",
    entity_type: "product",
    entity_id: data.id,
    after_json: data
  });

  await bestEffortSyncTables(["products", "inventory_balances"]);
  res.status(200).json({ ok: true, product: data });
}

async function discontinueProduct(req: ApiRequest, res: ApiResponse) {
  const actor = await requireAuth(req, ["ADMIN", "WAREHOUSE"]);
  const body = getJsonBody(req);
  const productId = optionalString(body.id ?? body.productId);
  if (!productId) {
    res.status(400).json({ ok: false, error: "Thiếu sản phẩm cần ngưng bán." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .update({
      status: "INACTIVE",
      lifecycle_status: "DISCONTINUED",
      updated_at: new Date().toISOString()
    })
    .eq("id", productId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("product_status_history").insert({
    product_id: productId,
    old_status: "ACTIVE",
    new_status: "DISCONTINUED",
    reason: optionalString(body.reason) ?? "Ngưng bán từ màn hàng hóa",
    changed_by: actor.id
  });

  await bestEffortSyncTables(["products", "product_status_history"]);
  res.status(200).json({ ok: true, product: data });
}

async function adjustInventory(req: ApiRequest, res: ApiResponse) {
  const body = getJsonBody(req);
  const mode = toStringValue(body.mode, "IN").toUpperCase();
  const allowedRoles = mode === "REQUEST_EXPORT" ? ["ADMIN", "WAREHOUSE", "SALE"] : ["ADMIN", "WAREHOUSE"];
  const actor = await requireAuth(req, allowedRoles);
  const productId = optionalString(body.productId);
  if (!productId) {
    res.status(400).json({ ok: false, error: "Thiếu sản phẩm." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const warehouseId = await ensureWarehouse(toStringValue(body.warehouseCode, "KHO-CHINH"));
  const quantity = Math.max(0, toNumber(body.quantity));
  const note = optionalString(body.note);

  const { data: balance, error: balanceError } = await supabase
    .from("inventory_balances")
    .select("id,quantity_box")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  if (balanceError) throw new Error(balanceError.message);

  const current = toNumber(balance?.quantity_box);
  let quantityChange = quantity;
  let stockAfter = current + quantity;
  let sourceType = "STOCK_IN";

  if (mode === "OUT") {
    quantityChange = -quantity;
    stockAfter = current - quantity;
    sourceType = "STOCK_OUT";
  } else if (mode === "COUNT") {
    stockAfter = quantity;
    quantityChange = stockAfter - current;
    sourceType = "STOCK_COUNT";
  } else if (mode === "REQUEST_EXPORT") {
    quantityChange = 0;
    stockAfter = current;
    sourceType = "STOCK_EXPORT_REQUEST";
  }

  const balancePayload = {
    warehouse_id: warehouseId,
    product_id: productId,
    quantity_box: stockAfter,
    quantity_piece: 0,
    updated_at: new Date().toISOString()
  };

  if (balance?.id) {
    await supabase.from("inventory_balances").update(balancePayload).eq("id", balance.id);
  } else {
    await supabase.from("inventory_balances").insert(balancePayload);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("inventory_transactions")
    .insert({
      warehouse_id: warehouseId,
      product_id: productId,
      source_type: sourceType,
      source_id: createCode(sourceType === "STOCK_EXPORT_REQUEST" ? "DXK" : "KHO"),
      quantity_change: quantityChange,
      stock_after: stockAfter,
      note: note ?? `${sourceType} bởi ${actor.email}`
    })
    .select("*")
    .single();
  if (transactionError) throw new Error(transactionError.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: mode,
    entity_type: "inventory",
    entity_id: transaction.id,
    after_json: transaction
  });

  await bestEffortSyncTables(["inventory_balances", "inventory_transactions"]);
  res.status(200).json({ ok: true, transaction, stockAfter });
}

async function getAppNotifications(req: ApiRequest, res: ApiResponse) {
  const actor = await requireAuth(req, ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"]);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let reminderQuery = supabase
    .from("debt_reminders")
    .select("id,order_debt_id,customer_id,assigned_to,reminder_type,channel,scheduled_at,status,title,message,created_at")
    .in("status", ["PENDING", "SCHEDULED"])
    .lte("scheduled_at", now);

  if (!["ADMIN", "ACCOUNTANT"].includes(actor.role)) {
    reminderQuery = reminderQuery.or(`assigned_to.is.null,assigned_to.eq.${actor.id}`);
  }

  const [{ data: notifications, error: notificationError }, { data: reminders, error: reminderError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
      .or(`user_id.is.null,user_id.eq.${actor.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
    reminderQuery
      .order("scheduled_at", { ascending: true })
      .limit(20)
  ]);

  if (notificationError) throw new Error(notificationError.message);
  if (reminderError) throw new Error(reminderError.message);

  const reminderItems = (reminders ?? []).map((item) => ({
    id: `reminder:${item.id}`,
    source: "debt_reminders",
    type: item.reminder_type ?? "DEBT_DUE",
    title: item.title ?? "Nhắc công nợ đến hạn",
    body: item.message ?? "Có khoản công nợ cần xử lý.",
    entityType: "debt_reminder",
    entityId: item.id,
    readAt: null,
    createdAt: item.scheduled_at ?? item.created_at,
    href: "/finance"
  }));

  const notificationItems = (notifications ?? []).map((item) => ({
    id: item.id,
    source: "notifications",
    type: item.type,
    title: item.title,
    body: item.body,
    entityType: item.entity_type,
    entityId: item.entity_id,
    readAt: item.read_at,
    createdAt: item.created_at,
    href: item.entity_type === "customer_debt" ? "/finance" : undefined
  }));

  const items = [...reminderItems, ...notificationItems]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 30);

  res.status(200).json({
    ok: true,
    items,
    unreadCount: items.filter((item) => !item.readAt).length
  });
}

async function markNotificationRead(req: ApiRequest, res: ApiResponse) {
  const actor = await requireAuth(req, ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"]);
  const body = getJsonBody(req);
  const id = optionalString(body.id);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (!id) {
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .or(`user_id.is.null,user_id.eq.${actor.id}`)
      .is("read_at", null);
    res.status(200).json({ ok: true });
    return;
  }

  if (id.startsWith("reminder:")) {
    const reminderId = id.replace("reminder:", "");
    const { error } = await supabase
      .from("debt_reminders")
      .update({ status: "SENT", sent_at: now })
      .eq("id", reminderId);
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true });
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", id)
    .or(`user_id.is.null,user_id.eq.${actor.id}`);
  if (error) throw new Error(error.message);
  res.status(200).json({ ok: true });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const table = getQueryValue(req.query?.table);
    if (table === "app-notifications") {
      if (req.method === "GET") {
        await getAppNotifications(req, res);
        return;
      }
      if (req.method === "PATCH") {
        await markNotificationRead(req, res);
        return;
      }
      return methodNotAllowed(res, ["GET", "PATCH"]);
    }

    if (table === "inventory-adjustments" && req.method === "POST") {
      await adjustInventory(req, res);
      return;
    }

    if (!table || !EXPORTABLE_TABLES.includes(table as ExportableTable)) {
      res.status(400).json({ ok: false, error: "Unsupported or missing table." });
      return;
    }

    if (table === "products" && ["POST", "PATCH"].includes(req.method ?? "")) {
      await saveProduct(req, res);
      return;
    }

    if (table === "products" && req.method === "DELETE") {
      await discontinueProduct(req, res);
      return;
    }

    if (table === "customers" && ["POST", "PATCH"].includes(req.method ?? "")) {
      await saveCustomer(req, res);
      return;
    }

    if (req.method !== "GET") return methodNotAllowed(res, ["GET", "POST", "PATCH"]);

    await requireAuth(req, TABLE_READ_ROLES[table as ExportableTable]);
    const rows = await fetchTableRows(table as ExportableTable);
    res.status(200).json({ ok: true, table, rows });
  } catch (error) {
    sendError(res, error);
  }
}
