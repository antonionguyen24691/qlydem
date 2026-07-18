import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { google } from "googleapis";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local", quiet: true });

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const shareEmail = process.env.GOOGLE_SHARE_EMAIL;
const title = process.env.GOOGLE_SHEETS_TITLE || `PMQL Supabase Backup ${new Date().toISOString().slice(0, 10)}`;

if (!clientEmail || !privateKey) {
  throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file"
  ]
});

await auth.authorize();
const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

const response = await sheets.spreadsheets.create({
  requestBody: {
    properties: { title },
    sheets: [
      { properties: { title: "products" } },
      { properties: { title: "inventory_balances" } },
      { properties: { title: "sales_orders" } },
      { properties: { title: "receipts" } },
      { properties: { title: "customer_debt_ledger" } },
      { properties: { title: "customers" } },
      { properties: { title: "suppliers" } },
      { properties: { title: "backup_log" } },
      { properties: { title: "PMQL_change_inbox" } }
    ]
  }
});

const spreadsheetId = response.data.spreadsheetId;
if (!spreadsheetId) throw new Error("Không tạo được Google Spreadsheet.");

if (shareEmail) {
  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: false,
    requestBody: {
      type: "user",
      role: "writer",
      emailAddress: shareEmail
    }
  });
}

console.log(JSON.stringify({
  ok: true,
  spreadsheetId,
  url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  shareEmail: shareEmail || null
}, null, 2));
