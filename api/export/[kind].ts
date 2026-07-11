import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { fetchTableRows, parseTables } from "../_lib/supabase.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requireAuth } from "../_lib/auth.js";
import { enforceRateLimit } from "../_lib/rateLimit.js";
import writeXlsxFile from "write-excel-file/node";
import billXlsx from "../_lib/exportBillXlsx.js";

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

function moneyCell(value: unknown) {
  return {
    type: Number,
    value: Number(value ?? 0),
    format: "#,##0"
  };
}

async function priceListXlsx(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    await requireAuth(req, ["ADMIN", "ACCOUNTANT"]);
    const supabase = getSupabaseAdmin();
    const { data: products, error } = await supabase
      .from("products")
      .select("code,product_name,invoice_name,category,unit,cost_price,sell_price_box_vat,status,updated_at")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);

    const data = [
      [
        cell("Mã hàng", "bold"),
        cell("Tên hàng hóa", "bold"),
        cell("Tên trên hóa đơn", "bold"),
        cell("Danh mục", "bold"),
        cell("ĐVT", "bold"),
        cell("Giá vốn", "bold"),
        cell("Giá bán hiện tại", "bold"),
        cell("Giá bán mới", "bold"),
        cell("Ghi chú", "bold"),
        cell("Trạng thái", "bold")
      ],
      ...(products ?? []).map((product: any) => [
        cell(product.code),
        cell(product.product_name),
        cell(product.invoice_name),
        cell(product.category),
        cell(product.unit),
        moneyCell(product.cost_price),
        moneyCell(product.sell_price_box_vat),
        moneyCell(product.sell_price_box_vat),
        cell(""),
        cell(product.status)
      ])
    ];

    const workbook = await writeXlsxFile([{ sheet: "Bang gia", data }]);
    const buffer = await workbook.toBuffer();
    const filename = `pmql-bang-gia-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}

async function tablesXlsx(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    // Export toàn bộ bảng tốn tài nguyên: giới hạn 10 lần / phút.
    enforceRateLimit(req, "export-tables", 10, 60_000);
    await requireAuth(req, ["ADMIN", "ACCOUNTANT"]);
    const tables = parseTables(getQueryValue(req.query?.tables));
    const sheets = [];

    for (const table of tables) {
      const rows = await fetchTableRows(table);
      sheets.push({
        sheet: table.slice(0, 31),
        data: rowsToSheet(rows)
      });
    }

    const workbook = await writeXlsxFile(sheets);
    const buffer = await workbook.toBuffer();
    const filename = `pmql-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const kind = getQueryValue(req.query?.kind);
  if (kind === "xlsx") return tablesXlsx(req, res);
  if (kind === "bill-xlsx") return billXlsx(req, res);
  if (kind === "price-list") return priceListXlsx(req, res);
  res.status(400).json({ ok: false, error: "Unsupported export kind." });
}
