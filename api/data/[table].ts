import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { EXPORTABLE_TABLES, fetchTableRows, type ExportableTable } from "../_lib/supabase.js";
import { requireAuth, requirePermission } from "../_lib/auth.js";
import { createCode, getJsonBody, optionalString, toNumber, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

const TABLE_READ_ROLES: Partial<Record<ExportableTable, string[]>> = {
  customers: ["ADMIN", "ACCOUNTANT", "SALE"],
  products: ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"],
  warehouses: ["ADMIN", "WAREHOUSE"],
  inventory_balances: ["ADMIN", "WAREHOUSE", "SALE"],
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
    .select("id,code,product_name,unit,cost_price,sell_price_box_vat")
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
      return { ...row, oldPrice, costPrice };
    })
    .filter((row) => row.newPrice !== row.oldPrice);

  for (const row of changedRows) {
    const { error: updateError } = await supabase
      .from("products")
      .update({
        sell_price_box_vat: row.newPrice,
        updated_at: now
      })
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
  const canApplyDirectly = actor.role === "ADMIN";

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

  let purchaseId: string | null = null;
  if (mode === "IN") {
    const lineTotal = quantity * unitCost;
    const totalAmount = Math.max(0, lineTotal - discountAmount + vatAmount);
    const payableAmount = Math.max(0, totalAmount - paidAmount);

    if (unitCost > 0 || supplierId || documentCode) {
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchase_orders")
        .insert({
          code: documentCode ?? createCode("PNK"),
          purchase_date: receivedAt,
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          subtotal: lineTotal,
          discount_amount: discountAmount,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          paid_amount: Math.min(paidAmount, totalAmount),
          payable_amount: payableAmount,
          status: "RECEIVED",
          note: [operationType, note].filter(Boolean).join(" - ")
        })
        .select("id")
        .single();
      if (purchaseError) throw new Error(purchaseError.message);
      purchaseId = purchase.id as string;

      const { data: product } = await supabase
        .from("products")
        .select("code,product_name,unit,cost_price")
        .eq("id", productId)
        .maybeSingle();

      const { error: itemError } = await supabase.from("purchase_order_items").insert({
        purchase_id: purchaseId,
        product_id: productId,
        product_code: product?.code,
        product_name: product?.product_name ?? "Hàng hóa",
        unit: product?.unit,
        quantity,
        unit_cost: unitCost,
        line_total: lineTotal
      });
      if (itemError) throw new Error(itemError.message);

      if (unitCost > 0 && stockAfter > 0) {
        const oldCost = toNumber(product?.cost_price);
        const weightedCost = Math.round(((current * oldCost) + (quantity * unitCost)) / stockAfter);
        const { error: costError } = await supabase
          .from("products")
          .update({ cost_price: weightedCost, updated_at: new Date().toISOString() })
          .eq("id", productId);
        if (costError) throw new Error(costError.message);
      }

      if (supplierId && payableAmount > 0) {
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("current_payable")
          .eq("id", supplierId)
          .maybeSingle();
        const balanceAfter = toNumber(supplier?.current_payable) + payableAmount;
        const { error: supplierError } = await supabase
          .from("suppliers")
          .update({ current_payable: balanceAfter, updated_at: new Date().toISOString() })
          .eq("id", supplierId);
        if (supplierError) throw new Error(supplierError.message);
        const { error: ledgerError } = await supabase.from("supplier_debt_ledger").insert({
          supplier_id: supplierId,
          source_type: "PURCHASE_ORDER",
          source_id: purchaseId,
          debit: payableAmount,
          credit: 0,
          balance_after: balanceAfter,
          status: "OPEN",
          note: documentCode ?? "Phiếu nhập kho"
        });
        if (ledgerError) throw new Error(ledgerError.message);
      }
    }
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
        source_type: mode === "IN" ? operationType : sourceType,
        source_id: purchaseId,
        quantity_change: quantityChange,
        stock_after: stockAfter,
        note: note ?? `${mode === "IN" ? operationType : sourceType} bởi ${actor.email}`
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

  await bestEffortSyncTables(["inventory_balances", "inventory_transactions", "purchase_orders", "purchase_order_items"]);
  res.status(200).json({ ok: true, transaction, stockAfter, purchaseId });
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
  const productIds = rows.map((row) => row.productId);
  const currentByProduct = await loadCurrentBalances(warehouseId, productIds);
  const now = new Date().toISOString();
  const changedRows = rows
    .map((row) => {
      const current = toNumber(currentByProduct.get(row.productId)?.quantity_box);
      const quantityChange = row.quantity - current;
      return { ...row, current, quantityChange };
    })
    .filter((row) => row.quantityChange !== 0);

  for (const row of changedRows) {
    const balance = currentByProduct.get(row.productId);
    const balancePayload = {
      warehouse_id: warehouseId,
      product_id: row.productId,
      quantity_box: row.quantity,
      quantity_piece: 0,
      updated_at: now
    };

    if (balance?.id) {
      const { error } = await supabase.from("inventory_balances").update(balancePayload).eq("id", balance.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("inventory_balances").insert(balancePayload);
      if (error) throw new Error(error.message);
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        warehouse_id: warehouseId,
        product_id: row.productId,
        source_type: sourceType,
        source_id: null,
        quantity_change: row.quantityChange,
        stock_after: row.quantity,
        note: row.note ?? note ?? "Kiểm kê sheet"
      })
      .select("id")
      .single();
    if (transactionError) throw new Error(transactionError.message);

    const { error: logError } = await supabase.from("inventory_edit_logs").insert({
      product_id: row.productId,
      warehouse_id: warehouseId,
      old_quantity_box: row.current,
      new_quantity_box: row.quantity,
      quantity_change: row.quantityChange,
      source_type: requestId ? "APPROVED_STOCK_COUNT" : "DIRECT_STOCK_COUNT",
      source_id: requestId ?? transaction.id,
      edited_by: actorId,
      approved_by: approverId ?? actorId,
      approved_at: now,
      note: row.note ?? note
    });
    if (logError) throw new Error(logError.message);
  }

  return changedRows;
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
  const canApplyDirectly = ["ADMIN", "WAREHOUSE"].includes(actor.role);

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
    let reminderQuery = supabase
      .from("debt_reminders")
      .update({ status: "SENT", sent_at: now })
      .in("status", ["PENDING", "SCHEDULED"])
      .lte("scheduled_at", now);
    if (!["ADMIN", "ACCOUNTANT"].includes(actor.role)) {
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

    const actor = await requireAuth(req, TABLE_READ_ROLES[table as ExportableTable]);
    const rows = await fetchTableRows(table as ExportableTable, actor);
    res.status(200).json({ ok: true, table, rows });
  } catch (error) {
    sendError(res, error);
  }
}
