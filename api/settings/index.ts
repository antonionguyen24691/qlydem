import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { getJsonBody, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

type BrandingSettings = {
  appName: string;
  companyName: string;
  appDescription: string;
  address: string;
  hotline: string;
  taxCode: string;
  logoUrl: string;
  faviconUrl: string;
};

const defaultBranding: BrandingSettings = {
  appName: "PMQL",
  companyName: "PMQL",
  appDescription: "Phần mềm quản lý bán hàng",
  address: "",
  hotline: "",
  taxCode: "",
  logoUrl: "",
  faviconUrl: ""
};

function normalizeBranding(input: Record<string, unknown>): BrandingSettings {
  return {
    appName: toStringValue(input.appName, defaultBranding.appName).trim() || defaultBranding.appName,
    companyName: toStringValue(input.companyName, defaultBranding.companyName).trim() || defaultBranding.companyName,
    appDescription: toStringValue(input.appDescription, defaultBranding.appDescription).trim() || defaultBranding.appDescription,
    address: toStringValue(input.address).trim(),
    hotline: toStringValue(input.hotline).trim(),
    taxCode: toStringValue(input.taxCode).trim(),
    logoUrl: toStringValue(input.logoUrl).trim(),
    faviconUrl: toStringValue(input.faviconUrl).trim()
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const key = getQueryValue(req.query?.key) ?? "branding";
    if (key !== "branding") {
      res.status(400).json({ ok: false, error: "Unsupported settings key." });
      return;
    }

    if (req.method === "GET") {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "branding")
          .maybeSingle();
        if (error) throw new Error(error.message);
        res.status(200).json({ ok: true, branding: normalizeBranding((data?.value as Record<string, unknown>) ?? {}) });
      } catch (error) {
        res.status(200).json({
          ok: true,
          branding: defaultBranding,
          warning: error instanceof Error ? error.message : "Không đọc được cấu hình Supabase."
        });
      }
      return;
    }

    if (req.method === "POST") {
      const actor = await requireAuth(req, ["ADMIN"]);
      const supabase = getSupabaseAdmin();
      const branding = normalizeBranding(getJsonBody(req));
      const { data, error } = await supabase
        .from("settings")
        .upsert({
          key: "branding",
          value: branding,
          updated_by: actor.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" })
        .select("value")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "UPDATE",
        entity_type: "settings",
        entity_id: "branding",
        after_json: data?.value ?? branding
      });

      res.status(200).json({ ok: true, branding: normalizeBranding((data?.value as Record<string, unknown>) ?? branding) });
      return;
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendError(res, error);
  }
}
