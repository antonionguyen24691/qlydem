import type { ApiRequest, ApiResponse } from "./http.js";
import { getQueryValue, methodNotAllowed, sendError } from "./http.js";
import { getJsonBody, optionalString, toStringValue } from "./body.js";
import { requirePermission } from "./auth.js";
import { getSupabaseAdmin } from "./supabase.js";
import { hasPermission } from "./permissions.js";

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;

function numberInRange(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function auditDetail(row: any) {
  const after = row.after_json;
  if (!after || typeof after !== "object") return String(row.entity_id ?? "");
  if (after.code || after.name || after.product_name) return [after.code, after.name ?? after.product_name].filter(Boolean).join(" - ");
  return JSON.stringify(after);
}

export default async function auditLogsHandler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requirePermission(req, "settings.manage");
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const actorId = optionalString(getQueryValue(req.query?.actorId));
      const action = optionalString(getQueryValue(req.query?.action));
      const format = getQueryValue(req.query?.format);
      const pageSize = numberInRange(getQueryValue(req.query?.pageSize), 30, 1, MAX_PAGE_SIZE);
      const page = numberInRange(getQueryValue(req.query?.page), 1, 1, 1_000_000);
      const limit = format === "csv" ? MAX_EXPORT_ROWS : pageSize;
      const from = format === "csv" ? 0 : (page - 1) * pageSize;
      let query = supabase
        .from("audit_logs")
        .select("id,actor_id,action,entity_type,entity_id,after_json,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);
      if (actorId) query = query.eq("actor_id", actorId);
      if (action) query = query.eq("action", action);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      const rows = data ?? [];

      if (format === "csv") {
        const header = ["Thời gian", "Người dùng", "Hành động", "Đối tượng", "Mã đối tượng", "Chi tiết"];
        const lines = [header.map(csvCell).join(","), ...rows.map((row) => [
          row.created_at ? new Date(row.created_at).toLocaleString("vi-VN") : "",
          row.actor_id,
          row.action,
          row.entity_type,
          row.entity_id,
          auditDetail(row)
        ].map(csvCell).join(","))];
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="nhat-ky-hoat-dong.csv"');
        res.status(200).send(`\uFEFF${lines.join("\r\n")}`);
        return;
      }

      res.status(200).json({ ok: true, rows, total: count ?? rows.length, page, pageSize });
      return;
    }

    if (req.method === "DELETE") {
      if (!hasPermission(actor.permissions, "audit.clear")) {
        const error = new Error("Bạn không có quyền xóa nhật ký hoạt động.");
        error.name = "FORBIDDEN";
        throw error;
      }
      const body = getJsonBody(req);
      if (toStringValue(body.confirmation).trim().toUpperCase() !== "XOA_NHAT_KY") {
        res.status(400).json({ ok: false, error: "Vui lòng nhập XOA_NHAT_KY để xác nhận xóa nhật ký." });
        return;
      }
      const beforeDate = optionalString(body.beforeDate);
      let deleteQuery = supabase.from("audit_logs").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (beforeDate) {
        const parsed = new Date(beforeDate);
        if (Number.isNaN(parsed.getTime())) {
          res.status(400).json({ ok: false, error: "Mốc thời gian xóa không hợp lệ." });
          return;
        }
        deleteQuery = deleteQuery.lt("created_at", parsed.toISOString());
      }
      const { count, error } = await deleteQuery;
      if (error) throw new Error(error.message);
      const deleted = count ?? 0;
      const { error: logError } = await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "CLEAR_AUDIT_LOGS",
        entity_type: "operations",
        entity_id: "audit_logs",
        after_json: { deleted, beforeDate: beforeDate ?? null }
      });
      if (logError) throw new Error(logError.message);
      res.status(200).json({ ok: true, deleted });
      return;
    }

    return methodNotAllowed(res, ["GET", "DELETE"]);
  } catch (error) {
    sendError(res, error);
  }
}
