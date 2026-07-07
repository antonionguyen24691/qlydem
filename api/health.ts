import type { ApiRequest, ApiResponse } from "./_lib/http";

export default function handler(_req: ApiRequest, res: ApiResponse) {
  res.status(200).json({
    ok: true,
    app: "crm-qlbh",
    time: new Date().toISOString(),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    googleSheetsConfigured: Boolean(
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    )
  });
}
