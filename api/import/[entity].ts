import type { IncomingMessage } from "node:http";
import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, requireInternalSecret, sendError } from "../_lib/http";
import { parseImportWorkbook } from "../_lib/importExcel";
import { isImportEntity } from "../_lib/importTemplates";
import { getSupabaseAdmin } from "../_lib/supabase";

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
    return {
      ...row,
      product_type: normalizeProductType(row.product_type),
      status: row.status ?? "ACTIVE",
      lifecycle_status: row.lifecycle_status ?? "ACTIVE"
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    requireInternalSecret(req);
    const entity = getQueryValue(req.query?.entity);
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
      .insert({ entity_type: entity, file_name: fileName ?? `${entity}.xlsx`, status: "PROCESSING" })
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);

    const parsedRows = await parseImportWorkbook(entity, buffer);
    const invalidRows = parsedRows.filter((row) => row.error);
    const validRows = parsedRows.filter((row) => !row.error).map((row) => normalizeRow(entity, row.data));

    let upserted = 0;
    let upsertError: string | undefined;
    if (validRows.length > 0) {
      const { error } = await supabase.from(entity).upsert(validRows, { onConflict: "code" });
      if (error) upsertError = error.message;
      else upserted = validRows.length;
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
