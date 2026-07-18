import { timingSafeEqual } from "node:crypto";
import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { getJsonBody, optionalString, toStringValue } from "../_lib/body.js";
import { requirePermission } from "../_lib/auth.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

const ALLOWED_FIELDS = {
  customers: new Set(["name", "short_name", "phone", "address", "tax_code", "customer_group", "credit_limit", "credit_days", "status", "note"]),
  suppliers: new Set(["name", "short_name", "phone", "address", "tax_code", "contact_person", "payment_terms", "status", "note"]),
  products: new Set(["invoice_name", "product_name", "category", "brand", "size", "unit", "barcode", "status", "lifecycle_status"])
} as const;

type EditableEntity = keyof typeof ALLOWED_FIELDS;

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function requireSheetSecret(req: ApiRequest) {
  const configured = process.env.GOOGLE_SHEETS_SYNC_SECRET;
  const header = req.headers?.["x-pmql-sync-secret"];
  const actual = Array.isArray(header) ? header[0] : header;
  if (!configured || !actual || !safeEqual(actual, configured)) {
    const error = new Error("Invalid Google Sheets sync secret.");
    error.name = "UNAUTHORIZED";
    throw error;
  }
}

function isEditableEntity(value: string): value is EditableEntity {
  return value === "customers" || value === "suppliers" || value === "products";
}

function normalizeValue(entity: EditableEntity, field: string, input: unknown) {
  const raw = toStringValue(input).trim();
  if (raw.length > 500) throw new Error("Giá trị từ Sheet dài quá 500 ký tự.");
  if (["credit_limit", "credit_days"].includes(field)) {
    const number = Number(raw.replace(/[,\s]/g, ""));
    if (!Number.isFinite(number) || number < 0) throw new Error(`Giá trị ${field} không hợp lệ.`);
    return number;
  }
  if (["status", "lifecycle_status"].includes(field)) return raw.toUpperCase();
  return raw;
}

async function receiveInbox(req: ApiRequest, res: ApiResponse) {
  requireSheetSecret(req);
  const body = getJsonBody<{ changes?: unknown }>(req);
  if (!Array.isArray(body.changes) || body.changes.length === 0) {
    res.status(400).json({ ok: false, error: "Không có thay đổi hợp lệ từ Google Sheet." });
    return;
  }
  if (body.changes.length > 200) {
    res.status(400).json({ ok: false, error: "Mỗi lần chỉ được gửi tối đa 200 thay đổi." });
    return;
  }

  const supabase = getSupabaseAdmin();
  const accepted: string[] = [];
  const rejected: Array<{ row: number; error: string }> = [];
  for (const [index, raw] of body.changes.entries()) {
    try {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dòng inbox không hợp lệ.");
      const change = raw as Record<string, unknown>;
      const entity = toStringValue(change.entity).trim() as EditableEntity;
      const code = toStringValue(change.code).trim();
      const field = toStringValue(change.field).trim();
      if (!isEditableEntity(entity) || !code || !ALLOWED_FIELDS[entity].has(field)) throw new Error("Chỉ cho phép sửa trường danh mục đã được hỗ trợ.");
      const { data: target, error } = await supabase.from(entity).select("id,code,updated_at").eq("code", code).maybeSingle();
      if (error) throw new Error(error.message);
      if (!target) throw new Error(`Không tìm thấy ${entity} có mã ${code}.`);
      const expected = optionalString(change.expected_updated_at);
      if (expected && new Date(expected).getTime() !== new Date(target.updated_at).getTime()) throw new Error("Dữ liệu gốc đã đổi; hãy đồng bộ Sheet lại rồi gửi lại.");
      const proposedValue = normalizeValue(entity, field, change.value);
      const payload = {
        entity_type: entity,
        target_code: code,
        target_id: target.id,
        field_name: field,
        proposed_value: proposedValue,
        expected_updated_at: target.updated_at,
        note: optionalString(change.note),
        status: "PENDING",
        submitted_at: new Date().toISOString(),
        error_message: null
      };
      const { data: pending, error: pendingError } = await supabase
        .from("sheet_change_requests")
        .select("id")
        .eq("entity_type", entity).eq("target_id", target.id).eq("field_name", field).eq("status", "PENDING")
        .maybeSingle();
      if (pendingError) throw new Error(pendingError.message);
      const { data: request, error: writeError } = pending?.id
        ? await supabase.from("sheet_change_requests").update(payload).eq("id", pending.id).select("id").single()
        : await supabase.from("sheet_change_requests").insert(payload).select("id").single();
      if (writeError) throw new Error(writeError.message);
      accepted.push(request.id);
    } catch (error) {
      const sourceRow = raw && typeof raw === "object" && !Array.isArray(raw) ? Number((raw as Record<string, unknown>).source_row) : 0;
      rejected.push({ row: Number.isInteger(sourceRow) && sourceRow > 1 ? sourceRow : index + 2, error: error instanceof Error ? error.message : "Không nhận được thay đổi." });
    }
  }
  res.status(200).json({ ok: true, accepted: accepted.length, rejected, requestIds: accepted });
}

async function listInbox(req: ApiRequest, res: ApiResponse) {
  await requirePermission(req, "settings.manage");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sheet_change_requests")
    .select("id,entity_type,target_code,field_name,proposed_value,expected_updated_at,note,status,submitted_at,error_message")
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  res.status(200).json({ ok: true, requests: data ?? [] });
}

async function reviewInbox(req: ApiRequest, res: ApiResponse) {
  const actor = await requirePermission(req, "settings.manage");
  const body = getJsonBody<{ id?: unknown; decision?: unknown }>(req);
  const id = toStringValue(body.id).trim();
  const decision = toStringValue(body.decision).trim().toUpperCase();
  if (!id || !["APPROVE", "REJECT"].includes(decision)) {
    res.status(400).json({ ok: false, error: "Thiếu yêu cầu hoặc quyết định duyệt/từ chối." });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data: request, error } = await supabase.from("sheet_change_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!request || request.status !== "PENDING") {
    res.status(400).json({ ok: false, error: "Yêu cầu không còn chờ duyệt." });
    return;
  }
  if (decision === "REJECT") {
    await supabase.from("sheet_change_requests").update({ status: "REJECTED", reviewed_by: actor.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    res.status(200).json({ ok: true, status: "REJECTED" });
    return;
  }

  const entity = request.entity_type as EditableEntity;
  if (!isEditableEntity(entity) || !ALLOWED_FIELDS[entity].has(request.field_name)) throw new Error("Yêu cầu chứa trường không được hỗ trợ.");
  const { data: current, error: currentError } = await supabase.from(entity).select("id,updated_at").eq("id", request.target_id).maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current || (request.expected_updated_at && new Date(current.updated_at).getTime() !== new Date(request.expected_updated_at).getTime())) {
    await supabase.from("sheet_change_requests").update({ status: "STALE", reviewed_by: actor.id, reviewed_at: new Date().toISOString(), error_message: "Dữ liệu app đã thay đổi sau khi gửi từ Sheet." }).eq("id", id);
    res.status(409).json({ ok: false, error: "Dữ liệu app đã thay đổi; yêu cầu đã được đánh dấu cũ." });
    return;
  }
  const value = normalizeValue(entity, request.field_name, request.proposed_value);
  const { error: updateError } = await supabase.from(entity).update({ [request.field_name]: value, updated_at: new Date().toISOString() }).eq("id", request.target_id);
  if (updateError) throw new Error(updateError.message);
  await supabase.from("sheet_change_requests").update({ status: "APPROVED", reviewed_by: actor.id, reviewed_at: new Date().toISOString(), applied_at: new Date().toISOString() }).eq("id", id);
  await supabase.from("audit_logs").insert({ actor_id: actor.id, action: "APPLY_GOOGLE_SHEETS_CHANGE", entity_type: entity, entity_id: request.target_id, after_json: { field: request.field_name, value, requestId: id } });
  res.status(200).json({ ok: true, status: "APPROVED" });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === "POST") return await receiveInbox(req, res);
    if (req.method === "GET") return await listInbox(req, res);
    if (req.method === "PATCH") return await reviewInbox(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  } catch (error) {
    sendError(res, error);
  }
}
