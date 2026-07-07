import writeXlsxFile from "write-excel-file/node";
import type { ApiRequest, ApiResponse } from "../_lib/http";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http";
import { IMPORT_TEMPLATES, isImportEntity } from "../_lib/importTemplates";

function cell(value: unknown, fontWeight?: "bold") {
  return {
    value: value === null || value === undefined ? "" : String(value),
    fontWeight
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const entity = getQueryValue(req.query?.entity);
    if (!isImportEntity(entity)) {
      res.status(400).json({ ok: false, error: "Template không hợp lệ. Dùng customers, suppliers hoặc products." });
      return;
    }

    const columns = IMPORT_TEMPLATES[entity];
    const workbook = await writeXlsxFile([
      {
        sheet: "data",
        data: [
          columns.map((column) => cell(`${column.label}${column.required ? " *" : ""}`, "bold")),
          columns.map((column) => cell(column.sample))
        ]
      },
      {
        sheet: "huong_dan",
        data: [
          [cell("Cột", "bold"), cell("Bắt buộc", "bold"), cell("Ghi chú", "bold")],
          ...columns.map((column) => [
            cell(column.label),
            cell(column.required ? "Có" : "Không"),
            cell(column.aliases?.length ? `Có thể nhận: ${column.aliases.join(", ")}` : "")
          ])
        ]
      }
    ]);

    const buffer = await workbook.toBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="crm-template-${entity}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}
