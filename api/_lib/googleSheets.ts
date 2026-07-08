import { google } from "googleapis";
import { getGooglePrivateKey } from "./env.js";

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

export async function replaceSheetRows(sheetName: string, rows: Record<string, unknown>[]) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const values = [
    headers,
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
