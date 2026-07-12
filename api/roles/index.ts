import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { requirePermission } from "../_lib/auth.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { getJsonBody, toStringValue } from "../_lib/body.js";
import { PERMISSION_CATALOG, PERMISSION_SCOPES } from "../_lib/permissions.js";

const PERMISSION_KEYS = new Set<string>(PERMISSION_CATALOG.map((item) => item.key));

// Chỉ giữ lại khoá quyền hợp lệ + giá trị scope hợp lệ; các khoá lạ bị loại bỏ
// thay vì được lưu thẳng vào roles.permissions_json.
function sanitizePermissionsJson(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (source.all === true) result.all = true;
  const configured = source.permissions;
  if (configured && typeof configured === "object" && !Array.isArray(configured)) {
    const permissions: Record<string, string> = {};
    for (const [key, scope] of Object.entries(configured as Record<string, unknown>)) {
      if (PERMISSION_KEYS.has(key) && typeof scope === "string" && (PERMISSION_SCOPES as readonly string[]).includes(scope)) {
        permissions[key] = scope;
      }
    }
    result.permissions = permissions;
  }
  return result;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requirePermission(req, "users.manage");
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase.from("roles").select("*").order("role");
      if (error) throw new Error(error.message);
      res.status(200).json({ ok: true, roles: data ?? [] });
      return;
    }

    if (req.method === "POST") {
      const body = getJsonBody(req);
      const role = toStringValue(body.role).trim().toUpperCase();
      const name = toStringValue(body.name).trim();
      const permissionsJson = sanitizePermissionsJson(body.permissionsJson);
      if (!role || !name) {
        res.status(400).json({ ok: false, error: "Thiếu mã quyền hoặc tên quyền." });
        return;
      }
      const { data, error } = await supabase
        .from("roles")
        .upsert({ role, name, permissions_json: permissionsJson, updated_at: new Date().toISOString() }, { onConflict: "role" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      // Đổi ma trận quyền là hành vi nhạy cảm — luôn ghi audit.
      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "UPDATE_ROLE_PERMISSIONS",
        entity_type: "role",
        entity_id: role,
        after_json: data
      });

      res.status(200).json({ ok: true, role: data });
      return;
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendError(res, error);
  }
}
