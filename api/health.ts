import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { methodNotAllowed } from "./_lib/http.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";

function setHealthHeaders(res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
}

/**
 * Public, non-sensitive liveness/readiness endpoint for Vercel monitoring.
 * It only exposes boolean dependency states; credentials and database details
 * never leave the server.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  setHealthHeaders(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const hasGoogleSheetsConfig = Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  const hasScheduledBackupConfig = hasGoogleSheetsConfig && Boolean(process.env.CRON_SECRET);

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("settings").select("key", { head: true }).limit(1);
    if (error) throw error;

    res.status(200).json({
      ok: true,
      status: "ready",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      checks: {
        database: "ready",
        googleSheetsBackup: hasGoogleSheetsConfig ? "configured" : "not_configured",
        scheduledGoogleSheetsBackup: hasScheduledBackupConfig ? "configured" : "not_configured"
      },
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? null
    });
  } catch {
    res.status(503).json({
      ok: false,
      status: "degraded",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      checks: {
        database: "unavailable",
        googleSheetsBackup: hasGoogleSheetsConfig ? "configured" : "not_configured",
        scheduledGoogleSheetsBackup: hasScheduledBackupConfig ? "configured" : "not_configured"
      }
    });
  }
}
