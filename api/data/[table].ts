import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { EXPORTABLE_TABLES, fetchTableRows, type ExportableTable } from "../_lib/supabase.js";
import { requireAuth, requirePermission } from "../_lib/auth.js";
import { createCode, getJsonBody, optionalString, toNumber, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";
import { enforceRateLimit } from "../_lib/rateLimit.js";
import sheetsInboxHandler from "../_lib/sheetsInbox.js";
import { hasPermission, permissionScope } from "../_lib/permissions.js";

const TABLE_READ_ROLES: Partial<Record<ExportableTable, string[]>> = {
  customers: ["ADMIN", "ACCOUNTANT", "SALE"],
  products: ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"],
  warehouses: ["ADMIN", "WAREHOUSE"],
  inventory_balances: ["ADMIN", "WAREHOUSE", "SALE"],
  product_lots: ["ADMIN", "ACCOUNTANT", "WAREHOUSE", "SALE"],
  inventory_lot_balances: ["ADMIN", "ACCOUNTANT", "WAREHOUSE", "SALE"],
  inventory_transactions: ["ADMIN", "WAREHOUSE"],
  inventory_adjustment_requests: ["ADMIN"],
  inventory_adjustment_request_items: ["ADMIN"],
  inventory_edit_logs: ["ADMIN", "WAREHOUSE", "ACCOUNTANT"],
  price_update_requests: ["ADMIN", "ACCOUNTANT"],
  price_update_request_items: ["ADMIN", "ACCOUNTANT"],
  price_edit_logs: ["ADMIN", "ACCOUNTANT"],
  sales_orders: ["ADMIN", "ACCOUNTANT", "SALE"],
  sales_order_items: ["ADMIN", "ACCOUNTANT", "SALE"],
  receipts: ["ADMIN", "ACCOUNTANT"],
  customer_debt_ledger: ["ADMIN", "ACCOUNTANT"],
  order_debts: ["ADMIN", "ACCOUNTANT", "SALE"],
  receipt_allocations: ["ADMIN", "ACCOUNTANT"],
  cashbook_entries: ["ADMIN", "ACCOUNTANT"],
  audit_logs: ["ADMIN"],
  suppliers: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  purchase_orders: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  purchase_order_items: ["ADMIN", "ACCOUNTANT", "WAREHOUSE"],
  supplier_debt_ledger: ["ADMIN", "ACCOUNTANT"]
};

const TABLE_READ_PERMISSIONS: Partial<Record<ExportableTable, string>> = {
  customers: "customers.view",
  products: "products.view",
  warehouses: "inventory.view",
  inventory_balances: "inventory.view",
  product_lots: "inventory.view",
  inventory_lot_balances: "inventory.view",
  inventory_transactions: "inventory.view",
  inventory_adjustment_requests: "inventory.manage",
  inventory_adjustment_request_items: "inventory.manage",
  inventory_edit_logs: "inventory.manage",
  price_update_requests: "orders.price_override",
  price_update_request_items: "orders.price_override",
  price_edit_logs: "orders.price_override",
  sales_orders: "orders.view",
  sales_order_items: "orders.view",
  receipts: "finance.view",
  customer_debt_ledger: "finance.view",
  order_debts: "finance.view",
  receipt_allocations: "finance.view",
  cashbook_entries: "finance.view",
  audit_logs: "settings.manage",
  supplier_debt_ledger: "finance.view",
  sales_returns: "orders.view",
  sales_return_items: "orders.view",
  customer_credit_ledger: "finance.view"
};

type InventoryReceiptItem = { productId?: string; quantity?: number; unitCost?: number; unit?: string; lotCode?: string; colorNote?: string; qualityNote?: string; imageUrls?: string[] };
type InventoryReceiptPayload = {
  supplierId?: string;
  warehouseCode?: string;
  receivedAt?: string;
  documentCode?: string;
  discountAmount?: number;
  vatAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  note?: string;
  idempotencyKey?: string;
  items?: InventoryReceiptItem[];
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
    track_lots: (body.trackLots ?? body.track_lots) === true,
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
    status: toStringValue(body.status, "ACTIVE").toUpperCase(),
    note: optionalString(body.note),
    updated_at: new Date().toISOString()
  };
}

function supplierPayload(body: Record<string, unknown>) {
  const name = toStringValue(body.name).trim();
  if (!name) {
    const error = new Error("Thiếu tên nhà cung cấp.");
    error.name = "BAD_REQUEST";
    throw error;
  }

  return {
    code: toStringValue(body.code, createCode("NCC")).trim(),
    name,
    short_name: optionalString(body.shortName ?? body.short_name),
    phone: optionalString(body.phone),
    address: optionalString(body.address),
    tax_code: optionalString(body.taxCode ?? body.tax_code),
    contact_person: optionalString(body.contactPerson ?? body.contact_person),
    payment_terms: optionalString(body.paymentTerms ?? body.payment_terms),
    status: toStringValue(body.status, "ACTIVE").toUpperCase(),
    note: optionalString(body.note),
    updated_at: new Date().toISOString()
  };
}

async function saveCustomer(req: ApiRequest, res: ApiResponse) {
  const body = getJsonBody(req);
  const existingId = optionalString(body.id);
  const actor = await requirePermission(req, existingId ? "customers.update" : "customers.create");
  const supabase = getSupabaseAdmin();
  const payload = {
    ...customerPayload(body),
    assigned_sale_id: actor.role === "SALE" ? actor.id : optionalString(body.assignedSaleId)
  };

  const query = existingId
    ? actor.role === "SALE"
      ? supabase.from("customers").update(payload).eq("id", existingId).eq("assigned_sale_id", actor.id).select("*").single()
      : supabase.from("customers").update(payload).eq("id", existingId).select("*").single()
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

async function saveSupplier(req: ApiRequest, res: ApiResponse) {
  const body = getJsonBody(req);
  const existingId = optionalString(body.id);
  const actor = await requirePermission(req, "inventory.manage");
  const supabase = getSupabaseAdmin();
  const payload = supplierPayload(body);
  const query = existingId
    ? supabase.from("suppliers").update(payload).eq("id", existingId).select("*").single()
    : supabase.from("suppliers").upsert(payload, { onConflict: "code" }).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: existingId ? "UPDATE" : "UPSERT",
    entity_type: "supplier",
    entity_id: data.id,
    after_json: data
  });
  await bestEffortSyncTables(["suppliers"]);
  res.status(200).json({ ok: true, supplier: data });
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
  const actor = await requirePermission(req, "products.manage");
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
  const actor = await requirePermission(req, "products.manage");
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

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "DISCONTINUE",
    entity_type: "product",
    entity_id: productId,
    after_json: { code: data?.code, name: data?.product_name, reason: optionalString(body.reason) ?? null }
  });

  await bestEffortSyncTables(["products", "product_status_history"]);
  res.status(200).json({ ok: true, product: data });
}

type PriceRow = {
  productId: string;
  newPrice: number;
  note?: string | null;
};

function normalizePriceRows(input: unknown): PriceRow[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        productId: toStringValue(item.productId ?? item.product_id ?? item.id).trim(),
        newPrice: Math.max(0, toNumber(item.newPrice ?? item.new_price ?? item.price ?? item.sellPrice)),
        note: optionalString(item.note)
      };
    })
    .filter((row) => row.productId);
}

async function loadProductsForPriceUpdate(productIds: string[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id,code,product_name,unit,cost_price,sell_price_box_vat,m2_per_box")
    .in("id", productIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((item: any) => [item.id, item]));
}

async function applyPriceRows({
  rows,
  actorId,
  approverId,
  sourceType,
  requestId,
  note
}: {
  rows: PriceRow[];
  actorId: string;
  approverId?: string;
  sourceType: string;
  requestId?: string;
  note?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const currentByProduct = await loadProductsForPriceUpdate(rows.map((row) => row.productId));
  const changedRows = rows
    .map((row) => {
      const current = currentByProduct.get(row.productId);
      const oldPrice = toNumber(current?.sell_price_box_vat);
      const costPrice = toNumber(current?.cost_price);
      const m2PerBox = toNumber(current?.m2_per_box);
      return { ...row, oldPrice, costPrice, m2PerBox };
    })
    .filter((row) => row.newPrice !== row.oldPrice);

  for (const row of changedRows) {
    // Giữ giá theo m2 quy đổi đúng theo giá hộp mới nhất, tránh lệch với hệ đơn vị của sản phẩm.
    const productUpdate: Record<string, unknown> = {
      sell_price_box_vat: row.newPrice,
      updated_at: now
    };
    if (row.m2PerBox > 0) {
      productUpdate.price_by_m2 = Math.round(row.newPrice / row.m2PerBox);
    }

    const { error: updateError } = await supabase
      .from("products")
      .update(productUpdate)
      .eq("id", row.productId);
    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from("price_edit_logs").insert({
      product_id: row.productId,
      old_sell_price: row.oldPrice,
      new_sell_price: row.newPrice,
      old_cost_price: row.costPrice,
      source_type: sourceType,
      source_id: requestId,
      edited_by: actorId,
      approved_by: approverId ?? actorId,
      approved_at: now,
      note: row.note ?? note
    });
    if (logError) throw new Error(logError.message);
  }

  return changedRows;
}

async function savePriceUpdateSheet(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "orders.price_override");
  const body = getJsonBody(req);
  const rows = normalizePriceRows(body.rows);
  if (rows.length === 0) {
    res.status(400).json({ ok: false, error: "Chưa có dòng giá bán hợp lệ." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const note = optionalString(body.note);
  const canApplyDirectly = hasPermission(actor.permissions, "price.update.apply");

  if (canApplyDirectly) {
    const changedRows = await applyPriceRows({
      rows,
      actorId: actor.id,
      sourceType: "DIRECT_PRICE_UPDATE",
      note
    });
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "PRICE_UPDATE_SHEET",
      entity_type: "price_update",
      entity_id: "direct",
      after_json: { changedRows: changedRows.length }
    });
    await bestEffortSyncTables(["products", "price_edit_logs"]);
    res.status(200).json({ ok: true, status: "APPLIED", changedRows: changedRows.length });
    return;
  }

  const currentByProduct = await loadProductsForPriceUpdate(rows.map((row) => row.productId));
  const itemRows = rows
    .map((row) => {
      const current = currentByProduct.get(row.productId);
      return {
        product_id: row.productId,
        old_sell_price: toNumber(current?.sell_price_box_vat),
        new_sell_price: row.newPrice,
        old_cost_price: toNumber(current?.cost_price),
        note: row.note
      };
    })
    .filter((row) => row.new_sell_price !== row.old_sell_price);

  const { data: request, error: requestError } = await supabase
    .from("price_update_requests")
    .insert({
      request_type: "SALE_PRICE_UPDATE",
      status: itemRows.length > 0 ? "PENDING" : "NO_CHANGE",
      requested_by: actor.id,
      note
    })
    .select("*")
    .single();
  if (requestError) throw new Error(requestError.message);

  if (itemRows.length === 0) {
    res.status(200).json({ ok: true, status: "NO_CHANGE", requestId: request.id, changedRows: 0 });
    return;
  }

  const { error: itemError } = await supabase
    .from("price_update_request_items")
    .insert(itemRows.map((row) => ({ ...row, request_id: request.id })));
  if (itemError) throw new Error(itemError.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "REQUEST_PRICE_UPDATE_APPROVAL",
    entity_type: "price_update_request",
    entity_id: request.id,
    after_json: { changedRows: itemRows.length }
  });

  res.status(200).json({ ok: true, status: "PENDING_APPROVAL", requestId: request.id, changedRows: itemRows.length });
}

async function getPriceUpdateRequests(req: ApiRequest, res: ApiResponse) {
  await requirePermission(req, "orders.price_override");
  const supabase = getSupabaseAdmin();
  const { data: requests, error } = await supabase
    .from("price_update_requests")
    .select("id,request_type,status,note,created_at,approved_at,rejected_at,requested_by,approved_by,rejected_by")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const requestIds = (requests ?? []).map((item: any) => item.id);
  const { data: items, error: itemError } = requestIds.length
    ? await supabase
        .from("price_update_request_items")
        .select("id,request_id,product_id,old_sell_price,new_sell_price,old_cost_price,note,products(code,product_name,unit)")
        .in("request_id", requestIds)
    : { data: [], error: null };
  if (itemError) throw new Error(itemError.message);

  res.status(200).json({
    ok: true,
    requests: (requests ?? []).map((request: any) => ({
      ...request,
      items: (items ?? []).filter((item: any) => item.request_id === request.id)
    }))
  });
}

async function reviewPriceUpdateRequest(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "products.manage");
  const body = getJsonBody(req);
  const requestId = optionalString(body.id ?? body.requestId);
  const decision = toStringValue(body.decision, "APPROVE").toUpperCase();
  if (!requestId) {
    res.status(400).json({ ok: false, error: "Thiếu lệnh giá bán cần duyệt." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: request, error: requestError } = await supabase
    .from("price_update_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (requestError) throw new Error(requestError.message);
  if (request.status !== "PENDING") {
    res.status(400).json({ ok: false, error: "Lệnh này không còn ở trạng thái chờ duyệt." });
    return;
  }
  if (request.requested_by === actor.id) {
    res.status(403).json({ ok: false, error: "Không thể tự duyệt lệnh giá bán do chính mình tạo." });
    return;
  }

  const now = new Date().toISOString();
  if (decision === "REJECT") {
    const { error } = await supabase
      .from("price_update_requests")
      .update({ status: "REJECTED", rejected_by: actor.id, rejected_at: now, updated_at: now })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true, status: "REJECTED" });
    return;
  }

  const { data: items, error: itemError } = await supabase
    .from("price_update_request_items")
    .select("*")
    .eq("request_id", requestId);
  if (itemError) throw new Error(itemError.message);

  const rows = (items ?? []).map((item: any) => ({
    productId: item.product_id,
    newPrice: toNumber(item.new_sell_price),
    note: item.note
  }));

  const changedRows = await applyPriceRows({
    rows,
    actorId: request.requested_by,
    approverId: actor.id,
    sourceType: "APPROVED_PRICE_UPDATE",
    requestId,
    note: request.note
  });

  const { error } = await supabase
    .from("price_update_requests")
    .update({ status: "APPROVED", approved_by: actor.id, approved_at: now, updated_at: now })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "APPROVE_PRICE_UPDATE",
    entity_type: "price_update_request",
    entity_id: requestId,
    after_json: { changedRows: changedRows.length }
  });
  await bestEffortSyncTables(["products", "price_edit_logs"]);
  res.status(200).json({ ok: true, status: "APPROVED", changedRows: changedRows.length });
}

async function adjustInventory(req: ApiRequest, res: ApiResponse) {
  const body = getJsonBody(req);
  const mode = toStringValue(body.mode, "IN").toUpperCase();
  const actor = await requirePermission(req, mode === "REQUEST_EXPORT" ? "inventory.view" : "inventory.manage");
  const productId = optionalString(body.productId);
  if (!productId) {
    res.status(400).json({ ok: false, error: "Thiếu sản phẩm." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const warehouseId = await ensureWarehouse(toStringValue(body.warehouseCode, "KHO-CHINH"));
  const quantity = Math.max(0, toNumber(body.quantity));
  const note = optionalString(body.note);
  const operationType = toStringValue(body.operationType, mode === "IN" ? "PURCHASE_IN" : mode).trim().toUpperCase();
  const documentCode = optionalString(body.documentCode);
  const supplierId = optionalString(body.supplierId);
  const receivedAt = optionalString(body.receivedAt ?? body.transactionDate) ?? new Date().toISOString();
  const unitCost = Math.max(0, toNumber(body.unitCost ?? body.costPrice));
  const discountAmount = Math.max(0, toNumber(body.discountAmount));
  const vatAmount = Math.max(0, toNumber(body.vatAmount));
  const paidAmount = Math.max(0, toNumber(body.paidAmount));

  if (mode === "OUT") {
    const key = optionalString(body.idempotencyKey) ?? createCode("OUT");
    const { data, error } = await supabase.rpc("create_inventory_stock_out_secure", {
      p_actor_id: actor.id,
      p_product_id: productId,
      p_warehouse_code: toStringValue(body.warehouseCode, "KHO-CHINH"),
      p_quantity: quantity,
      p_operation_type: operationType,
      p_note: note,
      p_idempotency_key: key
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không xuất kho được.");
    await bestEffortSyncTables(["inventory_balances", "inventory_transactions"]);
    res.status(200).json(data);
    return;
  }

  if (mode === "IN") {
    const key = optionalString(body.idempotencyKey) ?? createCode("IN");
    const baseStockInPayload = {
      p_actor_id: actor.id,
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_quantity: quantity,
      p_operation_type: operationType,
      p_transaction_note: note ?? `${operationType} bởi ${actor.email}`,
      p_supplier_id: supplierId ?? null,
      p_document_code: documentCode ?? null,
      p_purchase_note: [operationType, note].filter(Boolean).join(" - "),
      p_received_at: receivedAt,
      p_unit_cost: unitCost,
      p_discount_amount: discountAmount,
      p_vat_amount: vatAmount,
      p_paid_amount: paidAmount,
      p_idempotency_key: key
    };
    let { data, error } = await supabase.rpc("create_inventory_stock_in_secure", {
      ...baseStockInPayload,
      p_lot_code: optionalString(body.lotCode) ?? null,
      p_lot_id: optionalString(body.lotId) ?? null,
      p_color_note: optionalString(body.colorNote) ?? null,
      p_quality_note: optionalString(body.qualityNote) ?? null,
      p_image_urls: Array.isArray(body.imageUrls) ? body.imageUrls : []
    });
    // Fallback khi migration lô chưa được apply trên Supabase (RPC còn chữ ký cũ, chưa có tham số lô).
    if (error && /PGRST202|could not find|function .* does not exist|schema cache/i.test(error.message)) {
      ({ data, error } = await supabase.rpc("create_inventory_stock_in_secure", baseStockInPayload));
    }
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không nhập kho được.");
    await bestEffortSyncTables(["inventory_balances", "inventory_transactions", "purchase_orders", "purchase_order_items", "product_lots", "inventory_lot_balances"]);
    res.status(200).json(data);
    return;
  }

  if (mode === "COUNT") {
    const key = optionalString(body.idempotencyKey) ?? createCode("COUNT");
    const { data, error } = await supabase.rpc("apply_inventory_count_secure", {
      p_actor_id: actor.id,
      p_warehouse_code: toStringValue(body.warehouseCode, "KHO-CHINH"),
      p_rows: [{ product_id: productId, quantity, note: note ?? null }],
      p_note: note,
      p_idempotency_key: key
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? "Không kiểm kê được.");
    await bestEffortSyncTables(["inventory_balances", "inventory_transactions"]);
    res.status(200).json({ ok: true, transaction: null, stockAfter: quantity, purchaseId: null });
    return;
  }

  // REQUEST_EXPORT: chỉ ghi lại một yêu cầu, không đổi tồn kho — giữ nguyên đường ghi trực tiếp cũ.
  const { data: transaction, error: transactionError } = await supabase
    .from("inventory_transactions")
    .insert({
      warehouse_id: warehouseId,
      product_id: productId,
      source_type: "STOCK_EXPORT_REQUEST",
      quantity_change: 0,
      stock_after: toNumber((
        await supabase.from("inventory_balances").select("quantity_box").eq("warehouse_id", warehouseId).eq("product_id", productId).maybeSingle()
      ).data?.quantity_box),
      note: note ?? `STOCK_EXPORT_REQUEST bởi ${actor.email}`
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
  res.status(200).json({ ok: true, transaction, stockAfter: transaction.stock_after, purchaseId: null });
}

async function createInventoryReceipt(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "inventory.manage");
  const body = getJsonBody<InventoryReceiptPayload>(req);
  const header = req.headers?.["idempotency-key"] ?? req.headers?.["Idempotency-Key"];
  const key = optionalString(Array.isArray(header) ? header[0] : header) ?? optionalString(body.idempotencyKey);
  const supplierId = optionalString(body.supplierId);
  const items = (body.items ?? []).map((item) => ({
    product_id: optionalString(item.productId),
    quantity: toNumber(item.quantity),
    unit_cost: toNumber(item.unitCost),
    unit: optionalString(item.unit),
    lot_code: optionalString(item.lotCode) ?? null,
    color_note: optionalString(item.colorNote) ?? null,
    quality_note: optionalString(item.qualityNote) ?? null,
    image_urls: Array.isArray(item.imageUrls) ? item.imageUrls : []
  }));
  if (!supplierId || !key || items.length === 0) {
    const error = new Error("Thiếu nhà cung cấp, dòng hàng hoặc Idempotency-Key.");
    error.name = "BAD_REQUEST";
    throw error;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_inventory_receipt_secure", {
    p_actor_id: actor.id,
    p_supplier_id: supplierId,
    p_warehouse_code: optionalString(body.warehouseCode) ?? "KHO-CHINH",
    p_received_at: optionalString(body.receivedAt) ?? new Date().toISOString(),
    p_document_code: optionalString(body.documentCode),
    p_discount_amount: toNumber(body.discountAmount),
    p_vat_amount: toNumber(body.vatAmount),
    p_paid_amount: toNumber(body.paidAmount),
    p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
    p_note: optionalString(body.note),
    p_items: items,
    p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Không tạo được phiếu nhập kho.");
  void bestEffortSyncTables([
    "inventory_balances", "inventory_transactions", "purchase_orders", "purchase_order_items",
    "suppliers", "supplier_debt_ledger", "payments", "cashbook_entries"
  ]);
  res.status(200).json(data);
}

const CASHBOOK_ACCOUNTS = ["CASH", "BANK"] as const;

function cashbookCode(prefix: string) {
  return createCode(prefix);
}

type CashbookEntryDraft = {
  accountType: string;
  direction: "IN" | "OUT";
  sourceType: string;
  amount: number;
  note?: string | null;
  category?: string | null;
  person?: string | null;
  entryDate?: string | null;
  actorId: string;
  codePrefix: string;
};

// Ngày làm việc theo giờ Việt Nam (YYYY-MM-DD) — dùng cho entry_date của sổ quỹ.
const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function vnDateKey(date = new Date()) {
  return vnDateFormatter.format(date);
}

function cashbookRow(entry: CashbookEntryDraft, codeSuffix = "") {
  return {
    code: `${cashbookCode(entry.codePrefix)}${codeSuffix}`,
    account_type: entry.accountType,
    direction: entry.direction,
    source_type: entry.sourceType,
    amount: entry.amount,
    payment_method: entry.accountType === "BANK" ? "TRANSFER" : "CASH",
    note: entry.note ?? null,
    category: entry.category ?? null,
    person: entry.person ?? null,
    // Ngày sổ quỹ phải theo NGÀY LÀM VIỆC VN, không phải ngày UTC (toISOString),
    // nếu không giao dịch lúc 00:00–07:00 giờ VN sẽ bị ghi lùi 1 ngày.
    entry_date: entry.entryDate ?? vnDateKey(),
    created_by: entry.actorId
  };
}

// Ghi 1..n bút toán trong một câu lệnh insert duy nhất để cặp bút toán chuyển quỹ luôn nguyên tử.
async function insertCashbookEntries(rows: ReturnType<typeof cashbookRow>[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cashbook_entries")
    .insert(rows)
    .select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

const MAX_CASHBOOK_AMOUNT = 100_000_000_000; // 100 tỷ: chặn số nhập lỗi/tràn, vẫn dư cho nghiệp vụ thật.

// Mỗi nghiệp vụ quỹ cần quyền riêng: chi phí = finance.expense.create; chuyển/rút/điều chỉnh = finance.fund.manage.
const CASHBOOK_PERMISSION: Record<string, string> = {
  EXPENSE: "finance.expense.create",
  TRANSFER: "finance.fund.manage",
  WITHDRAW: "finance.fund.manage",
  ADJUST: "finance.fund.manage"
};

function normalizeEntryDate(input: unknown, res: ApiResponse): string | null | false {
  const value = optionalString(input);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ ok: false, error: "Ngày ghi sổ không hợp lệ." });
    return false;
  }
  // Chặn ngày tương lai (cho phép trễ tối đa 1 ngày do lệch múi giờ client).
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    res.status(400).json({ ok: false, error: "Không được ghi sổ quỹ với ngày trong tương lai." });
    return false;
  }
  return value.slice(0, 10);
}

async function createCashbookTransaction(req: ApiRequest, res: ApiResponse) {
  const body = getJsonBody(req);
  const action = toStringValue(body.action).trim().toUpperCase();
  const permission = CASHBOOK_PERMISSION[action];
  if (!permission) {
    res.status(400).json({ ok: false, error: "Nghiệp vụ quỹ không được hỗ trợ." });
    return;
  }

  enforceRateLimit(req, "cashbook", 30, 60_000);
  const actor = await requirePermission(req, permission);
  const amount = Math.round(toNumber(body.amount));
  const note = optionalString(body.note);
  const person = optionalString(body.person);
  const entryDate = normalizeEntryDate(body.entryDate, res);
  if (entryDate === false) return;

  if (amount <= 0) {
    res.status(400).json({ ok: false, error: "Số tiền phải lớn hơn 0." });
    return;
  }
  if (amount > MAX_CASHBOOK_AMOUNT) {
    res.status(400).json({ ok: false, error: "Số tiền vượt giới hạn cho phép." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const entries: any[] = [];

  if (action === "TRANSFER") {
    const fromAccount = toStringValue(body.fromAccount, "CASH").toUpperCase();
    const toAccount = toStringValue(body.toAccount, "BANK").toUpperCase();
    if (!CASHBOOK_ACCOUNTS.includes(fromAccount as any) || !CASHBOOK_ACCOUNTS.includes(toAccount as any) || fromAccount === toAccount) {
      res.status(400).json({ ok: false, error: "Tài khoản chuyển/nhận không hợp lệ." });
      return;
    }
    const transferNote = note ?? (fromAccount === "CASH" ? "Nộp tiền mặt vào ngân hàng" : "Rút ngân hàng về quỹ tiền mặt");
    entries.push(...await insertCashbookEntries([
      cashbookRow({
        accountType: fromAccount, direction: "OUT", sourceType: "FUND_TRANSFER",
        amount, note: transferNote, person, entryDate, actorId: actor.id, codePrefix: "CQ"
      }, "-OUT"),
      cashbookRow({
        accountType: toAccount, direction: "IN", sourceType: "FUND_TRANSFER",
        amount, note: transferNote, person, entryDate, actorId: actor.id, codePrefix: "CQ"
      }, "-IN")
    ]));
  } else if (action === "WITHDRAW") {
    const accountType = toStringValue(body.accountType, "CASH").toUpperCase();
    const purpose = optionalString(body.purpose) ?? note;
    if (!CASHBOOK_ACCOUNTS.includes(accountType as any)) {
      res.status(400).json({ ok: false, error: "Tài khoản rút không hợp lệ." });
      return;
    }
    if (!purpose || !person) {
      res.status(400).json({ ok: false, error: "Rút quỹ phải ghi rõ mục đích và người rút." });
      return;
    }
    entries.push(...await insertCashbookEntries([cashbookRow({
      accountType, direction: "OUT", sourceType: "FUND_WITHDRAWAL",
      amount, note: purpose, person, entryDate, actorId: actor.id, codePrefix: "RQ"
    })]));
  } else if (action === "EXPENSE") {
    const accountType = toStringValue(body.accountType, "CASH").toUpperCase();
    const category = optionalString(body.category);
    if (!CASHBOOK_ACCOUNTS.includes(accountType as any)) {
      res.status(400).json({ ok: false, error: "Nguồn chi không hợp lệ." });
      return;
    }
    if (!category) {
      res.status(400).json({ ok: false, error: "Chi phí phải chọn loại chi phí." });
      return;
    }
    entries.push(...await insertCashbookEntries([cashbookRow({
      accountType, direction: "OUT", sourceType: "EXPENSE",
      amount, note, category, person, entryDate, actorId: actor.id, codePrefix: "PC"
    })]));
  } else if (action === "ADJUST") {
    if (!hasPermission(actor.permissions, "finance.fund.adjust")) {
      res.status(403).json({ ok: false, error: "Bạn không có quyền điều chỉnh số dư quỹ." });
      return;
    }
    const accountType = toStringValue(body.accountType, "CASH").toUpperCase();
    const direction = toStringValue(body.direction, "IN").toUpperCase();
    if (!CASHBOOK_ACCOUNTS.includes(accountType as any) || !["IN", "OUT"].includes(direction)) {
      res.status(400).json({ ok: false, error: "Điều chỉnh quỹ không hợp lệ." });
      return;
    }
    entries.push(...await insertCashbookEntries([cashbookRow({
      accountType, direction: direction as "IN" | "OUT", sourceType: "FUND_ADJUSTMENT",
      amount, note: note ?? "Điều chỉnh số dư quỹ", person, entryDate, actorId: actor.id, codePrefix: "DC"
    })]));
  }

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: `CASHBOOK_${action}`,
    entity_type: "cashbook_entry",
    entity_id: entries[0]?.id ?? null,
    after_json: { action, amount, entries: entries.map((entry) => entry.id) }
  });
  void bestEffortSyncTables(["cashbook_entries"]);
  res.status(200).json({ ok: true, entries });
}

type CountRow = {
  productId: string;
  quantity: number;
  note?: string | null;
};

function normalizeCountRows(input: unknown): CountRow[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        productId: toStringValue(item.productId ?? item.product_id).trim(),
        quantity: Math.max(0, toNumber(item.quantity ?? item.newQuantity ?? item.new_quantity_box)),
        note: optionalString(item.note)
      };
    })
    .filter((row) => row.productId);
}

async function loadCurrentBalances(warehouseId: string, productIds: string[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inventory_balances")
    .select("id,product_id,quantity_box")
    .eq("warehouse_id", warehouseId)
    .in("product_id", productIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((item: any) => [item.product_id, item]));
}

async function applyInventoryCountRows({
  rows,
  warehouseId,
  actorId,
  approverId,
  sourceType,
  requestId,
  note
}: {
  rows: CountRow[];
  warehouseId: string;
  actorId: string;
  approverId?: string;
  sourceType: string;
  requestId?: string;
  note?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: warehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .select("code")
    .eq("id", warehouseId)
    .single();
  if (warehouseError) throw new Error(warehouseError.message);
  const { data, error } = await supabase.rpc("apply_inventory_count_secure", {
    p_actor_id: approverId ?? actorId,
    p_warehouse_code: warehouse.code,
    p_rows: rows.map((row) => ({ product_id: row.productId, quantity: row.quantity, note: row.note })),
    p_note: [sourceType, note].filter(Boolean).join(" - ") || null,
    p_idempotency_key: requestId ?? crypto.randomUUID()
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Không áp dụng được kiểm kê.");
  return Array.from({ length: Number(data.changedRows ?? 0) }, () => ({}));
}

async function adjustCustomerDebt(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "finance.fund.manage");
  const body = getJsonBody(req);
  const customerId = optionalString(body.customerId);
  const delta = toNumber(body.delta);
  const note = optionalString(body.note);
  const key = optionalString(body.idempotencyKey);
  if (!customerId || !delta || !note || !key) {
    res.status(400).json({ ok: false, error: "Thiếu khách hàng, số điều chỉnh, lý do hoặc Idempotency-Key." });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("adjust_customer_debt_secure", {
    p_actor_id: actor.id, p_customer_id: customerId, p_delta: delta, p_note: note, p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  await bestEffortSyncTables(["customers", "customer_debt_ledger"]);
  res.status(200).json(data);
}

async function createSupplierPayment(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "finance.expense.create");
  const body = getJsonBody(req);
  const supplierId = optionalString(body.supplierId);
  const amount = toNumber(body.amount);
  const key = optionalString(body.idempotencyKey);
  if (!supplierId || amount <= 0 || !key) {
    res.status(400).json({ ok: false, error: "Thiếu nhà cung cấp, số tiền hoặc Idempotency-Key." });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_supplier_payment_secure", {
    p_actor_id: actor.id,
    p_supplier_id: supplierId,
    p_amount: amount,
    p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
    p_note: optionalString(body.note),
    p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  await bestEffortSyncTables(["suppliers", "purchase_orders", "payments", "supplier_debt_ledger", "cashbook_entries"]);
  res.status(200).json(data);
}

// Hẹn trả nợ: ghi nhận lời hứa thanh toán của khách để theo dõi thu hồi công nợ.
async function handlePaymentPromises(req: ApiRequest, res: ApiResponse) {
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    await requirePermission(req, "finance.view");
    const customerId = getQueryValue(req.query?.customerId);
    let query: any = supabase
      .from("payment_promises")
      .select("*")
      .order("status", { ascending: false })
      .order("promised_date", { ascending: true })
      .limit(500);
    if (customerId) query = query.eq("customer_id", customerId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true, rows: data ?? [] });
    return;
  }

  if (req.method === "POST") {
    const actor = await requirePermission(req, "finance.receipt.create");
    const body = getJsonBody(req);
    const customerId = optionalString(body.customerId);
    const promisedAmount = toNumber(body.promisedAmount);
    const promisedDateRaw = optionalString(body.promisedDate);
    if (!customerId || promisedAmount <= 0 || !promisedDateRaw) {
      res.status(400).json({ ok: false, error: "Thiếu khách hàng, số tiền hoặc ngày hẹn trả." });
      return;
    }
    const promisedDate = new Date(promisedDateRaw);
    if (Number.isNaN(promisedDate.getTime())) {
      res.status(400).json({ ok: false, error: "Ngày hẹn trả không hợp lệ." });
      return;
    }
    const { data: customer, error: customerError } = await supabase
      .from("customers").select("id,name").eq("id", customerId).maybeSingle();
    if (customerError) throw new Error(customerError.message);
    if (!customer) {
      res.status(400).json({ ok: false, error: "Không tìm thấy khách hàng." });
      return;
    }
    const { data, error } = await supabase
      .from("payment_promises")
      .insert({
        customer_id: customerId,
        promised_amount: promisedAmount,
        promised_date: promisedDate.toISOString().slice(0, 10),
        status: "OPEN",
        contact_name: optionalString(body.contactName),
        contact_phone: optionalString(body.contactPhone),
        note: optionalString(body.note),
        created_by: actor.id
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "CREATE",
      entity_type: "payment_promise",
      entity_id: data.id,
      after_json: { promise: data, customerName: customer.name }
    });
    res.status(200).json({ ok: true, promise: data });
    return;
  }

  if (req.method === "PATCH") {
    const actor = await requirePermission(req, "finance.receipt.create");
    const body = getJsonBody(req);
    const promiseId = optionalString(body.id);
    const status = toStringValue(body.status).trim().toUpperCase();
    if (!promiseId || !["KEPT", "BROKEN", "OPEN"].includes(status)) {
      res.status(400).json({ ok: false, error: "Thiếu phiếu hẹn trả hoặc trạng thái không hợp lệ (KEPT/BROKEN/OPEN)." });
      return;
    }
    const { data, error } = await supabase
      .from("payment_promises")
      .update({ status, resolved_at: status === "OPEN" ? null : new Date().toISOString() })
      .eq("id", promiseId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "UPDATE",
      entity_type: "payment_promise",
      entity_id: promiseId,
      after_json: { status }
    });
    res.status(200).json({ ok: true, promise: data });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

type SalesReturnItemInput = { productId?: string; quantity?: number; condition?: string };

// Trả hàng một phần: hàng tốt về kho bán, hàng lỗi vào KHO-LOI; tiền hoàn cấn nợ
// trước rồi mới chi tiền/cộng số dư theo phương thức chọn.
async function createSalesReturn(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "orders.return");
  const body = getJsonBody(req);
  const orderId = optionalString(body.orderId);
  const key = optionalString(body.idempotencyKey);
  const items = (Array.isArray(body.items) ? body.items as SalesReturnItemInput[] : []).map((item) => ({
    product_id: optionalString(item.productId),
    quantity: toNumber(item.quantity),
    condition: toStringValue(item.condition, "GOOD").trim().toUpperCase()
  })).filter((item) => item.product_id && item.quantity > 0);
  if (!orderId || !key || items.length === 0) {
    res.status(400).json({ ok: false, error: "Thiếu đơn hàng, dòng hàng trả hoặc Idempotency-Key." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_sales_return_secure", {
    p_actor_id: actor.id,
    p_order_id: orderId,
    p_items: items,
    p_reason_code: toStringValue(body.reasonCode, "KHAC").trim().toUpperCase(),
    p_reason: optionalString(body.reason) ?? null,
    p_refund_method: toStringValue(body.refundMethod, "CASH").trim().toUpperCase(),
    p_note: optionalString(body.note) ?? null,
    p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Không tạo được phiếu trả hàng.");
  void bestEffortSyncTables([
    "sales_orders", "sales_returns", "sales_return_items", "customers", "customer_credit_ledger",
    "customer_debt_ledger", "order_debts", "inventory_balances", "inventory_transactions", "cashbook_entries"
  ]);
  res.status(200).json(data);
}

// Rút số dư (tiền khách gửi/hoàn) trả lại khách bằng tiền mặt hoặc chuyển khoản.
async function withdrawCustomerCredit(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "finance.fund.manage");
  const body = getJsonBody(req);
  const customerId = optionalString(body.customerId);
  const amount = toNumber(body.amount);
  const key = optionalString(body.idempotencyKey);
  if (!customerId || amount <= 0 || !key) {
    res.status(400).json({ ok: false, error: "Thiếu khách hàng, số tiền hoặc Idempotency-Key." });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("withdraw_customer_credit_secure", {
    p_actor_id: actor.id,
    p_customer_id: customerId,
    p_amount: amount,
    p_payment_method: optionalString(body.paymentMethod) ?? "CASH",
    p_note: optionalString(body.note) ?? null,
    p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Không rút được số dư.");
  void bestEffortSyncTables(["customers", "customer_credit_ledger", "cashbook_entries"]);
  res.status(200).json(data);
}

async function cancelSalesOrder(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "orders.cancel");
  const body = getJsonBody(req);
  const orderId = optionalString(body.orderId);
  const reason = optionalString(body.reason);
  const key = optionalString(body.idempotencyKey);
  if (!orderId || !reason || !key) {
    res.status(400).json({ ok: false, error: "Thiếu đơn hàng, lý do hoặc Idempotency-Key." });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("cancel_sales_order_secure", {
    p_actor_id: actor.id, p_order_id: orderId, p_reason: reason, p_idempotency_key: key
  });
  if (error) throw new Error(error.message);
  await bestEffortSyncTables(["sales_orders", "customers", "customer_debt_ledger", "order_debts", "inventory_balances", "inventory_transactions", "cashbook_entries"]);
  res.status(200).json(data);
}

async function saveInventoryCountSheet(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "inventory.manage");
  const body = getJsonBody(req);
  const rows = normalizeCountRows(body.rows);
  if (rows.length === 0) {
    res.status(400).json({ ok: false, error: "Chưa có dòng kiểm kê hợp lệ." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const warehouseId = await ensureWarehouse(toStringValue(body.warehouseCode, "KHO-CHINH"));
  const note = optionalString(body.note);
  const canApplyDirectly = hasPermission(actor.permissions, "inventory.count.apply");

  if (canApplyDirectly) {
    const changedRows = await applyInventoryCountRows({
      rows,
      warehouseId,
      actorId: actor.id,
      sourceType: "STOCK_COUNT_SHEET",
      note
    });
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "STOCK_COUNT_SHEET",
      entity_type: "inventory",
      entity_id: "direct",
      after_json: { changedRows: changedRows.length }
    });
    await bestEffortSyncTables(["inventory_balances", "inventory_transactions"]);
    res.status(200).json({ ok: true, status: "APPLIED", changedRows: changedRows.length });
    return;
  }

  const productIds = rows.map((row) => row.productId);
  const currentByProduct = await loadCurrentBalances(warehouseId, productIds);
  const { data: request, error: requestError } = await supabase
    .from("inventory_adjustment_requests")
    .insert({
      request_type: "STOCK_COUNT",
      status: "PENDING",
      warehouse_id: warehouseId,
      requested_by: actor.id,
      note
    })
    .select("*")
    .single();
  if (requestError) throw new Error(requestError.message);

  const itemRows = rows
    .map((row) => {
      const current = toNumber(currentByProduct.get(row.productId)?.quantity_box);
      return {
        request_id: request.id,
        product_id: row.productId,
        old_quantity_box: current,
        new_quantity_box: row.quantity,
        quantity_change: row.quantity - current,
        note: row.note
      };
    })
    .filter((row) => row.quantity_change !== 0);

  if (itemRows.length === 0) {
    await supabase.from("inventory_adjustment_requests").update({ status: "NO_CHANGE", updated_at: new Date().toISOString() }).eq("id", request.id);
    res.status(200).json({ ok: true, status: "NO_CHANGE", requestId: request.id, changedRows: 0 });
    return;
  }

  const { error: itemError } = await supabase.from("inventory_adjustment_request_items").insert(itemRows);
  if (itemError) throw new Error(itemError.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "REQUEST_STOCK_COUNT_APPROVAL",
    entity_type: "inventory_adjustment_request",
    entity_id: request.id,
    after_json: { changedRows: itemRows.length }
  });
  res.status(200).json({ ok: true, status: "PENDING_APPROVAL", requestId: request.id, changedRows: itemRows.length });
}

async function getInventoryApprovalRequests(req: ApiRequest, res: ApiResponse) {
  await requirePermission(req, "inventory.manage");
  const supabase = getSupabaseAdmin();
  const { data: requests, error } = await supabase
    .from("inventory_adjustment_requests")
    .select("id,request_type,status,note,created_at,approved_at,rejected_at,requested_by,approved_by,rejected_by")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const requestIds = (requests ?? []).map((item: any) => item.id);
  const { data: items, error: itemError } = requestIds.length
    ? await supabase
        .from("inventory_adjustment_request_items")
        .select("id,request_id,product_id,old_quantity_box,new_quantity_box,quantity_change,note,products(code,product_name,unit)")
        .in("request_id", requestIds)
    : { data: [], error: null };
  if (itemError) throw new Error(itemError.message);

  res.status(200).json({
    ok: true,
    requests: (requests ?? []).map((request: any) => ({
      ...request,
      items: (items ?? []).filter((item: any) => item.request_id === request.id)
    }))
  });
}

async function reviewInventoryApprovalRequest(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "inventory.manage");
  const body = getJsonBody(req);
  const requestId = optionalString(body.id ?? body.requestId);
  const decision = toStringValue(body.decision, "APPROVE").toUpperCase();
  if (!requestId) {
    res.status(400).json({ ok: false, error: "Thiếu lệnh kiểm kê cần duyệt." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: request, error: requestError } = await supabase
    .from("inventory_adjustment_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (requestError) throw new Error(requestError.message);
  if (request.status !== "PENDING") {
    res.status(400).json({ ok: false, error: "Lệnh này không còn ở trạng thái chờ duyệt." });
    return;
  }
  if (request.requested_by === actor.id) {
    res.status(403).json({ ok: false, error: "Không thể tự duyệt lệnh kiểm kê do chính mình tạo." });
    return;
  }

  const now = new Date().toISOString();
  if (decision === "REJECT") {
    const { error } = await supabase
      .from("inventory_adjustment_requests")
      .update({ status: "REJECTED", rejected_by: actor.id, rejected_at: now, updated_at: now })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true, status: "REJECTED" });
    return;
  }

  const { data: items, error: itemError } = await supabase
    .from("inventory_adjustment_request_items")
    .select("*")
    .eq("request_id", requestId);
  if (itemError) throw new Error(itemError.message);

  const rows = (items ?? []).map((item: any) => ({
    productId: item.product_id,
    quantity: toNumber(item.new_quantity_box),
    note: item.note
  }));

  const changedRows = await applyInventoryCountRows({
    rows,
    warehouseId: request.warehouse_id,
    actorId: request.requested_by,
    approverId: actor.id,
    sourceType: "APPROVED_STOCK_COUNT",
    requestId,
    note: request.note
  });

  const { error } = await supabase
    .from("inventory_adjustment_requests")
    .update({ status: "APPROVED", approved_by: actor.id, approved_at: now, updated_at: now })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "APPROVE_STOCK_COUNT",
    entity_type: "inventory_adjustment_request",
    entity_id: requestId,
    after_json: { changedRows: changedRows.length }
  });
  await bestEffortSyncTables(["inventory_balances", "inventory_transactions"]);
  res.status(200).json({ ok: true, status: "APPROVED", changedRows: changedRows.length });
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

  if (permissionScope(actor.permissions, "finance.view") !== "all") {
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
    let reminderQuery = supabase
      .from("debt_reminders")
      .update({ status: "SENT", sent_at: now })
      .in("status", ["PENDING", "SCHEDULED"])
      .lte("scheduled_at", now);
    if (permissionScope(actor.permissions, "finance.view") !== "all") {
      reminderQuery = reminderQuery.or(`assigned_to.is.null,assigned_to.eq.${actor.id}`);
    }
    await reminderQuery;
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

    if (table === "inventory-receipts" && req.method === "POST") {
      await createInventoryReceipt(req, res);
      return;
    }

    if (table === "cashbook-transactions" && req.method === "POST") {
      await createCashbookTransaction(req, res);
      return;
    }

    if (table === "customer-debt-adjustments" && req.method === "POST") {
      await adjustCustomerDebt(req, res);
      return;
    }

    if (table === "supplier-payments" && req.method === "POST") {
      await createSupplierPayment(req, res);
      return;
    }

    if (table === "sales-order-cancellations" && req.method === "POST") {
      await cancelSalesOrder(req, res);
      return;
    }

    if (table === "sales-returns" && req.method === "POST") {
      await createSalesReturn(req, res);
      return;
    }

    if (table === "customer-credit-withdrawals" && req.method === "POST") {
      await withdrawCustomerCredit(req, res);
      return;
    }

    if (table === "payment-promises") {
      await handlePaymentPromises(req, res);
      return;
    }

    // Hàng chờ thay đổi từ Google Sheet (trước là /api/sync/google-sheets-inbox —
    // gộp vào đây để giữ giới hạn 12 serverless function của Vercel Hobby).
    if (table === "sheet-inbox") {
      await sheetsInboxHandler(req, res);
      return;
    }

    if (table === "inventory-count-sheet" && req.method === "POST") {
      await saveInventoryCountSheet(req, res);
      return;
    }

    if (table === "inventory-approval-requests") {
      if (req.method === "GET") {
        await getInventoryApprovalRequests(req, res);
        return;
      }
      if (req.method === "PATCH") {
        await reviewInventoryApprovalRequest(req, res);
        return;
      }
      return methodNotAllowed(res, ["GET", "PATCH"]);
    }

    if (table === "price-update-sheet" && req.method === "POST") {
      await savePriceUpdateSheet(req, res);
      return;
    }

    if (table === "price-update-requests") {
      if (req.method === "GET") {
        await getPriceUpdateRequests(req, res);
        return;
      }
      if (req.method === "PATCH") {
        await reviewPriceUpdateRequest(req, res);
        return;
      }
      return methodNotAllowed(res, ["GET", "PATCH"]);
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

    if (table === "suppliers" && ["POST", "PATCH"].includes(req.method ?? "")) {
      await saveSupplier(req, res);
      return;
    }

    if (req.method !== "GET") return methodNotAllowed(res, ["GET", "POST", "PATCH"]);

    const readPermission = TABLE_READ_PERMISSIONS[table as ExportableTable];
    const actor = readPermission
      ? await requirePermission(req, readPermission)
      : await requireAuth(req, TABLE_READ_ROLES[table as ExportableTable]);
    const rows = await fetchTableRows(table as ExportableTable, actor);
    res.status(200).json({ ok: true, table, rows });
  } catch (error) {
    sendError(res, error);
  }
}
