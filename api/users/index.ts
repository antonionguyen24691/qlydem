import type { ApiRequest, ApiResponse } from "../_lib/http";
import { methodNotAllowed, sendError } from "../_lib/http";
import { requireAuth } from "../_lib/auth";
import { getSupabaseAdmin } from "../_lib/supabase";
import { getJsonBody, optionalString, toStringValue } from "../_lib/body";
import { upsertAuthPassword } from "../_lib/authUsers";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requireAuth(req, ["ADMIN"]);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("users")
        .select("id,email,full_name,phone,role,status,sale_code,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.status(200).json({ ok: true, users: data ?? [] });
      return;
    }

    if (req.method === "POST") {
      const body = getJsonBody(req);
      const email = toStringValue(body.email).trim().toLowerCase();
      const fullName = toStringValue(body.fullName).trim();
      const role = toStringValue(body.role, "SALE").trim().toUpperCase();
      const password = optionalString(body.password);
      if (!email || !fullName) {
        res.status(400).json({ ok: false, error: "Thiếu email hoặc họ tên." });
        return;
      }

      await upsertAuthPassword(supabase, email, password);

      const { data, error } = await supabase
        .from("users")
        .upsert({
          email,
          full_name: fullName,
          phone: optionalString(body.phone),
          role,
          status: toStringValue(body.status, "ACTIVE").toUpperCase(),
          sale_code: optionalString(body.saleCode),
          updated_at: new Date().toISOString()
        }, { onConflict: "email" })
        .select("id,email,full_name,phone,role,status,sale_code,created_at,updated_at")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "UPSERT",
        entity_type: "user",
        entity_id: data.id,
        after_json: data
      });

      res.status(200).json({ ok: true, user: data });
      return;
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendError(res, error);
  }
}
