import type { IncomingMessage } from "node:http";
import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { parseImportWorkbook } from "../_lib/importExcel.js";
import { isImportEntity, normalizeHeader } from "../_lib/importTemplates.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requireAuth } from "../_lib/auth.js";
import { readSheet } from "read-excel-file/node";

export const config = {
  api: {
    bodyParser: false
  }
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  return normalized ? Number(normalized) : 0;
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

async function importPriceList(req: ApiRequest, res: ApiResponse) {
  const user = await requireAuth(req, ["ADMIN", "ACCOUNTANT"]);
  const buffer = await readBody(req as unknown as IncomingMessage);
  if (buffer.length === 0) {
    res.status(400).json({ ok: false, error: "File upload rỗng." });
    return;
  }

  const rows = await readSheet(buffer);
  if (rows.length < 2) throw new Error("File bảng giá phải có header và ít nhất 1 dòng dữ liệu.");

  const headerMap = rows[0].map((header) => normalizeHeader(header));
  const codeIndex = headerMap.findIndex((header) => ["ma hang", "code", "sku"].includes(header));
  const priceIndex = headerMap.findIndex((header) => ["gia ban moi", "new price", "sell price", "gia ban", "sell price box vat", "sell price box"].includes(header));
  const noteIndex = headerMap.findIndex((header) => ["ghi chu", "note"].includes(header));
  if (codeIndex < 0 || priceIndex < 0) {
    res.status(400).json({ ok: false, error: "File cần có cột Mã hàng và Giá bán mới." });
    return;
  }

  const parsedRows = rows.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      code: textValue(row[codeIndex]),
      newPrice: Math.max(0, toNumber(row[priceIndex])),
      note: noteIndex >= 0 ? textValue(row[noteIndex]) : ""
    }))
    .filter((row) => row.code || row.newPrice > 0);

  const supabase = getSupabaseAdmin();
  const filenameHeader = req.headers?.["x-file-name"];
  const fileName = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ entity_type: "price-list", file_name: fileName ?? "bang-gia.xlsx", status: "PROCESSING", created_by: user.id })
    .select("id")
    .single();
  if (batchError) throw new Error(batchError.message);

  const codes = parsedRows.map((row) => row.code).filter(Boolean);
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id,code,product_name,cost_price,sell_price_box_vat")
    .in("code", codes);
  if (productError) throw new Error(productError.message);

  const productByCode = new Map((products ?? []).map((product: any) => [product.code, product]));
  const errors = parsedRows
    .filter((row) => !row.code || !productByCode.has(row.code))
    .map((row) => ({
      batch_id: batch.id,
      row_number: row.rowNumber,
      entity_type: "price-list",
      row_json: row,
      error_message: !row.code ? "Thiếu mã hàng" : `Không tìm thấy mã hàng ${row.code}`
    }));

  const validRows = parsedRows
    .filter((row) => row.code && productByCode.has(row.code))
    .map((row) => {
      const product = productByCode.get(row.code);
      return {
        product,
        code: row.code,
        newPrice: row.newPrice,
        note: row.note,
        oldPrice: toNumber(product.sell_price_box_vat),
        costPrice: toNumber(product.cost_price)
      };
    })
    .filter((row) => row.newPrice !== row.oldPrice);

  if (errors.length > 0) await supabase.from("import_errors").insert(errors);

  let status = "NO_CHANGE";
  if (validRows.length > 0 && user.role === "ADMIN") {
    for (const row of validRows) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("products")
        .update({ sell_price_box_vat: row.newPrice, updated_at: now })
        .eq("id", row.product.id);
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("price_edit_logs").insert({
        product_id: row.product.id,
        old_sell_price: row.oldPrice,
        new_sell_price: row.newPrice,
        old_cost_price: row.costPrice,
        source_type: "IMPORT_PRICE_LIST",
        edited_by: user.id,
        approved_by: user.id,
        approved_at: now,
        note: row.note
      });
      if (logError) throw new Error(logError.message);
    }
    status = "APPLIED";
  } else if (validRows.length > 0) {
    const { data: request, error: requestError } = await supabase
      .from("price_update_requests")
      .insert({
        request_type: "SALE_PRICE_IMPORT",
        status: "PENDING",
        requested_by: user.id,
        note: `Import bảng giá ${fileName ?? ""}`.trim()
      })
      .select("id")
      .single();
    if (requestError) throw new Error(requestError.message);

    const { error: itemError } = await supabase.from("price_update_request_items").insert(validRows.map((row) => ({
      request_id: request.id,
      product_id: row.product.id,
      old_sell_price: row.oldPrice,
      new_sell_price: row.newPrice,
      old_cost_price: row.costPrice,
      note: row.note
    })));
    if (itemError) throw new Error(itemError.message);
    status = "PENDING_APPROVAL";
  }

  await supabase
    .from("import_batches")
    .update({
      total_rows: parsedRows.length,
      success_rows: validRows.length,
      failed_rows: errors.length,
      status: errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      completed_at: new Date().toISOString()
    })
    .eq("id", batch.id);

  res.status(200).json({
    ok: true,
    batchId: batch.id,
    entity: "price-list",
    status,
    totalRows: parsedRows.length,
    successRows: validRows.length,
    failedRows: errors.length
  });
}

function normalizeProductType(value: unknown) {
  const raw = String(value ?? "MERCHANDISE").trim().toUpperCase();
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

function normalizeRow(entity: string, row: Record<string, unknown>) {
  if (entity === "products") {
    const { warehouse_code, opening_stock, min_stock_level, ...productRow } = row;
    return {
      ...productRow,
      product_type: normalizeProductType(row.product_type),
      status: row.status ?? "ACTIVE",
      lifecycle_status: row.lifecycle_status ?? "ACTIVE",
      _inventory: {
        warehouse_code,
        opening_stock,
        min_stock_level
      }
    };
  }
  if (entity === "customers") {
    return {
      ...row,
      customer_group: row.customer_group ?? "RETAIL",
      status: row.status ?? "ACTIVE"
    };
  }
  if (entity === "suppliers") {
    return {
      ...row,
      status: row.status ?? "ACTIVE"
    };
  }
  return row;
}

async function ensureWarehouse(code: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ code, name: code, status: "ACTIVE" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function upsertProductOpeningStock(rows: Array<Record<string, unknown>>) {
  const inventoryRows = rows
    .filter((row) => row._inventory && typeof row._inventory === "object")
    .map((row) => ({
      code: String(row.code),
      inventory: row._inventory as Record<string, unknown>
    }))
    .filter((row) => Number(row.inventory.opening_stock ?? 0) !== 0);

  if (inventoryRows.length === 0) return;

  const supabase = getSupabaseAdmin();
  const codes = inventoryRows.map((row) => row.code);
  const { data: products, error } = await supabase
    .from("products")
    .select("id,code")
    .in("code", codes);
  if (error) throw new Error(error.message);

  const productByCode = new Map((products ?? []).map((product) => [product.code, product.id]));
  const balanceRows = [];
  for (const row of inventoryRows) {
    const productId = productByCode.get(row.code);
    if (!productId) continue;
    const warehouseCode = String(row.inventory.warehouse_code ?? "KHO-CHINH");
    const warehouseId = await ensureWarehouse(warehouseCode);
    balanceRows.push({
      warehouse_id: warehouseId,
      product_id: productId,
      quantity_box: Number(row.inventory.opening_stock ?? 0),
      quantity_piece: 0,
      min_stock_level: Number(row.inventory.min_stock_level ?? 0)
    });
  }

  if (balanceRows.length > 0) {
    const { error: balanceError } = await supabase
      .from("inventory_balances")
      .upsert(balanceRows, { onConflict: "warehouse_id,product_id" });
    if (balanceError) throw new Error(balanceError.message);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const entity = getQueryValue(req.query?.entity);
    if (entity === "price-list") {
      await importPriceList(req, res);
      return;
    }
    const user = await requireAuth(req, ["ADMIN"]);
    if (!isImportEntity(entity)) {
      res.status(400).json({ ok: false, error: "Import không hợp lệ. Dùng customers, suppliers hoặc products." });
      return;
    }

    const buffer = await readBody(req as unknown as IncomingMessage);
    if (buffer.length === 0) {
      res.status(400).json({ ok: false, error: "File upload rỗng." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const filenameHeader = req.headers?.["x-file-name"];
    const fileName = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({ entity_type: entity, file_name: fileName ?? `${entity}.xlsx`, status: "PROCESSING", created_by: user.id })
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);

    const parsedRows = await parseImportWorkbook(entity, buffer);
    const invalidRows = parsedRows.filter((row) => row.error);
    const normalizedRows = parsedRows.filter((row) => !row.error).map((row) => normalizeRow(entity, row.data));
    const validRows = normalizedRows.map(({ _inventory, ...row }) => row);

    let upserted = 0;
    let upsertError: string | undefined;
    if (validRows.length > 0) {
      const { error } = await supabase.from(entity).upsert(validRows, { onConflict: "code" });
      if (error) upsertError = error.message;
      else {
        if (entity === "products") await upsertProductOpeningStock(normalizedRows);
        upserted = validRows.length;
      }
    }

    const allErrors = [
      ...invalidRows.map((row) => ({
        batch_id: batch.id,
        row_number: row.rowNumber,
        entity_type: entity,
        row_json: row.raw,
        error_message: row.error ?? "Dòng không hợp lệ"
      })),
      ...(upsertError ? [{
        batch_id: batch.id,
        row_number: 0,
        entity_type: entity,
        row_json: { validRows },
        error_message: upsertError
      }] : [])
    ];

    if (allErrors.length > 0) {
      await supabase.from("import_errors").insert(allErrors);
    }

    const failedRows = invalidRows.length + (upsertError ? validRows.length : 0);
    await supabase
      .from("import_batches")
      .update({
        total_rows: parsedRows.length,
        success_rows: upserted,
        failed_rows: failedRows,
        status: failedRows > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        completed_at: new Date().toISOString()
      })
      .eq("id", batch.id);

    res.status(200).json({
      ok: !upsertError,
      batchId: batch.id,
      entity,
      totalRows: parsedRows.length,
      successRows: upserted,
      failedRows,
      error: upsertError
    });
  } catch (error) {
    sendError(res, error);
  }
}
