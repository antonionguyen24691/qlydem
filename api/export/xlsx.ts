import writeXlsxFile from "write-excel-file/node";
import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, requireInternalSecret, sendError } from "../_lib/http";
import { fetchTableRows, parseTables } from "../_lib/supabase";

function cell(value: unknown, fontWeight?: "bold") {
  return {
    value: value === null || value === undefined ? "" : String(value),
    fontWeight
  };
}

function rowsToSheet(rows: Record<string, unknown>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    headers.map((header) => cell(header, "bold")),
    ...rows.map((row) => headers.map((header) => cell(row[header])))
  ];
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    requireInternalSecret(req);
    const tables = parseTables(getQueryValue(req.query?.tables));
    const sheets = [];

    for (const table of tables) {
      const rows = await fetchTableRows(table);
      sheets.push({
        name: table.slice(0, 31),
        data: rowsToSheet(rows)
      });
    }

    const workbook = await writeXlsxFile(sheets);
    const buffer = await workbook.toBuffer();
    const filename = `crm-qlbh-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}
