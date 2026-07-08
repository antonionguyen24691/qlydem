import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { getJsonBody, toStringValue } from "../_lib/body.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requireAuth(req, req.method === "GET" ? undefined : ["ADMIN"]);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase.from("roles").select("*").order("role");
      if (error) throw new Error(error.message);
      res.status(200).json({ ok: true, roles: data ?? [] });
      return;
    }

    if (req.method === "POST") {
      if (actor.role !== "ADMIN") {
        const error = new Error("Only ADMIN can update roles.");
        error.name = "FORBIDDEN";
        throw error;
      }
      const body = getJsonBody(req);
      const role = toStringValue(body.role).trim().toUpperCase();
      const name = toStringValue(body.name).trim();
      const permissionsJson = typeof body.permissionsJson === "object" ? body.permissionsJson : {};
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
      res.status(200).json({ ok: true, role: data });
      return;
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendError(res, error);
  }
}
