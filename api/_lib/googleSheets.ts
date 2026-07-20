import { google } from "googleapis";
import { getGooglePrivateKey } from "./env.js";
import { fetchTableRows, type ExportableTable } from "./supabase.js";
import { sheetNameVi, columnLabelVi } from "./sheetLocale.js";

export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    getGooglePrivateKey() &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

export async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();

  if (!clientEmail || !privateKey || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw new Error("Missing Google Sheets service account env.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function toSheetValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export async function replaceSheetRows(sheetName: string, rows: Record<string, unknown>[], existingSheets?: ReturnType<typeof google.sheets>) {
  const sheets = existingSheets ?? await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const values = [
    headers.map((header) => columnLabelVi(header)),
    ...rows.map((row) => headers.map((header) => toSheetValue(row[header])))
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A:ZZ`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: values.length > 1 ? values : [["empty"]]
    }
  });
}

async function appendBackupLog(sheets: ReturnType<typeof google.sheets>, synced: Array<{ table: string; rows: number }>) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetNameVi("backup_log")}'!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[new Date().toISOString(), synced.map((item) => item.table).join(","), JSON.stringify(synced), "COMPLETED", "Supabase -> Google Sheets"]]
    }
  });
}

export async function syncTablesToGoogleSheets(tables: ExportableTable[]) {
  const synced: Array<{ table: string; rows: number }> = [];
  const sheets = await getSheetsClient();
  for (const table of tables) {
    const rows = await fetchTableRows(table);
    await replaceSheetRows(sheetNameVi(table), rows, sheets);
    synced.push({ table, rows: rows.length });
  }
  await appendBackupLog(sheets, synced);
  return synced;
}

export async function bestEffortSyncTables(tables: ExportableTable[]) {
  if (process.env.ENABLE_TRANSACTION_SHEETS_SYNC !== "1") return;
  if (!isGoogleSheetsConfigured()) return;
  try {
    await syncTablesToGoogleSheets(tables);
  } catch (error) {
    console.warn("Google Sheets backup sync failed", error);
  }
}
