import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http";
import { fetchTableRows, parseTables } from "../_lib/supabase";
import { replaceSheetRows } from "../_lib/googleSheets";
import { requireAuth } from "../_lib/auth";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    await requireAuth(req, ["ADMIN"]);
    const tables = parseTables(getQueryValue(req.query?.tables));
    const synced: Array<{ table: string; rows: number }> = [];

    for (const table of tables) {
      const rows = await fetchTableRows(table);
      await replaceSheetRows(table, rows);
      synced.push({ table, rows: rows.length });
    }

    res.status(200).json({ ok: true, synced, syncedAt: new Date().toISOString() });
  } catch (error) {
    sendError(res, error);
  }
}
