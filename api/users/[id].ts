import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { requirePermission } from "../_lib/auth.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { getJsonBody, optionalString, toStringValue } from "../_lib/body.js";
import { upsertAuthPassword } from "../_lib/authUsers.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const actor = await requirePermission(req, "users.manage");
    const id = getQueryValue(req.query?.id);
    const supabase = getSupabaseAdmin();

    if (!id && req.method === "GET") {
      const { data, error } = await supabase
        .from("users")
        .select("id,email,full_name,phone,role,status,sale_code,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.status(200).json({ ok: true, users: data ?? [] });
      return;
    }

    if (!id && req.method === "POST") {
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

    if (!id) {
      res.status(400).json({ ok: false, error: "Thiếu user id." });
      return;
    }

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

    return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
  } catch (error) {
    sendError(res, error);
  }
}
