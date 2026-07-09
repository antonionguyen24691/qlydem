import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { parseTables } from "../_lib/supabase.js";
import { syncTablesToGoogleSheets } from "../_lib/googleSheets.js";
import { requirePermission } from "../_lib/auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (!["GET", "POST"].includes(req.method ?? "")) return methodNotAllowed(res, ["GET", "POST"]);

  try {
    if (req.method === "GET") {
      const expected = process.env.CRON_SECRET;
      const authHeader = req.headers?.authorization ?? req.headers?.Authorization;
      const actual = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (!expected || actual !== `Bearer ${expected}`) {
        res.status(401).json({ ok: false, error: "Unauthorized cron request." });
        return;
      }
    } else {
      await requirePermission(req, "settings.manage");
    }

    const tables = parseTables(getQueryValue(req.query?.tables));
    const synced = await syncTablesToGoogleSheets(tables);

    res.status(200).json({ ok: true, synced, syncedAt: new Date().toISOString() });
  } catch (error) {
    sendError(res, error);
  }
}
