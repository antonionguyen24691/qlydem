import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http";
import { EXPORTABLE_TABLES, fetchTableRows, type ExportableTable } from "../_lib/supabase";
import { requireAuth } from "../_lib/auth";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    await requireAuth(req);
    const table = getQueryValue(req.query?.table);
    if (!table || !EXPORTABLE_TABLES.includes(table as ExportableTable)) {
      res.status(400).json({ ok: false, error: "Unsupported or missing table." });
      return;
    }

    const rows = await fetchTableRows(table as ExportableTable);
    res.status(200).json({ ok: true, table, rows });
  } catch (error) {
    sendError(res, error);
  }
}
