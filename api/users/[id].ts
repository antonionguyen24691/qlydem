import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http";
import { requireAuth } from "../_lib/auth";
import { getSupabaseAdmin } from "../_lib/supabase";
import { getJsonBody, optionalString, toStringValue } from "../_lib/body";
import { upsertAuthPassword } from "../_lib/authUsers";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requireAuth(req, ["ADMIN"]);
    const id = getQueryValue(req.query?.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "Thiếu user id." });
      return;
    }

    const supabase = getSupabaseAdmin();

    if (req.method === "PATCH") {
      const body = getJsonBody(req);
      const password = optionalString(body.password);
      if (password) {
        const { data: currentUser, error: currentUserError } = await supabase
          .from("users")
          .select("email")
          .eq("id", id)
          .single();
        if (currentUserError) throw new Error(currentUserError.message);
        await upsertAuthPassword(supabase, currentUser.email, password);
      }

      const patch = {
        full_name: optionalString(body.fullName),
        phone: optionalString(body.phone),
        role: optionalString(body.role)?.toUpperCase(),
        status: optionalString(body.status)?.toUpperCase(),
        sale_code: optionalString(body.saleCode),
        updated_at: new Date().toISOString()
      };
      const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

      const { data, error } = await supabase
        .from("users")
        .update(cleanPatch)
        .eq("id", id)
        .select("id,email,full_name,phone,role,status,sale_code,created_at,updated_at")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "UPDATE",
        entity_type: "user",
        entity_id: id,
        after_json: data
      });

      res.status(200).json({ ok: true, user: data });
      return;
    }

    if (req.method === "DELETE") {
      const { data, error } = await supabase
        .from("users")
        .update({ status: "INACTIVE", updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,email,full_name,phone,role,status,sale_code,created_at,updated_at")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "DEACTIVATE",
        entity_type: "user",
        entity_id: id,
        after_json: data
      });

      res.status(200).json({ ok: true, user: data });
      return;
    }

    return methodNotAllowed(res, ["PATCH", "DELETE"]);
  } catch (error) {
    sendError(res, error);
  }
}
