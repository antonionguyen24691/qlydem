import { readSheet } from "read-excel-file/node";
import { buildHeaderMap, getRequiredKeys, normalizeHeader, type ImportEntity } from "./importTemplates.js";

export type ParsedImportRow = {
  rowNumber: number;
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
  error?: string;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  return normalized ? Number(normalized) : undefined;
}

function cleanValue(key: string, value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  if (
    key.includes("amount") ||
    key.includes("price") ||
    key.includes("debt") ||
    key.includes("limit") ||
    key.includes("days") ||
    key.includes("m2") ||
    key.includes("pieces") ||
    key.includes("vat") ||
    key.includes("payable") ||
    key.includes("stock")
  ) {
    return toNumber(value);
  }
  return typeof value === "string" ? value.trim() : value;
}

export async function parseImportWorkbook(entity: ImportEntity, buffer: Buffer): Promise<ParsedImportRow[]> {
  const rows = await readSheet(buffer);
  if (rows.length < 2) throw new Error("File import phải có header và ít nhất 1 dòng dữ liệu.");

  const headerMap = buildHeaderMap(entity);
  const headers = rows[0].map((header) => headerMap.get(normalizeHeader(header)) ?? "");
  const requiredKeys = getRequiredKeys(entity);

  return rows.slice(1).map((row, index) => {
    const data: Record<string, unknown> = {};
    const raw: Record<string, unknown> = {};

    row.forEach((value, columnIndex) => {
      const header = String(rows[0][columnIndex] ?? "");
      const key = headers[columnIndex];
      raw[header] = value;
      if (key) {
        const cleaned = cleanValue(key, value);
        if (cleaned !== undefined) data[key] = cleaned;
      }
    });

    const missing = requiredKeys.filter((key) => !data[key]);
    return {
      rowNumber: index + 2,
      data,
      raw,
      error: missing.length > 0 ? `Thiếu cột bắt buộc: ${missing.join(", ")}` : undefined
    };
  }).filter((row) => Object.keys(row.data).length > 0 || Object.values(row.raw).some(Boolean));
}
