import { existsSync, readFileSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readSheet } from "read-excel-file/node";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local", quiet: true });

const workbookPath = process.argv[2] || "NHAT KY BAN HANG.xlsx";
const sheet = process.argv[3] || "CỬA HÀNG";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "your-service-role-key") {
  throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY thật.");
}
if (!existsSync(workbookPath)) throw new Error(`Không tìm thấy file: ${workbookPath}`);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function text(value) {
  return String(value ?? "").trim();
}

function customerCode(stt, fallbackIndex) {
  const number = Number(stt);
  const index = Number.isFinite(number) && number > 0 ? number : fallbackIndex + 1;
  return `KH${String(index).padStart(3, "0")}`;
}

const rows = await readSheet(readFileSync(workbookPath), sheet);
const customers = rows
  .slice(1)
  .map((row, index) => {
    const name = text(row[1]);
    if (!name) return null;
    return {
      code: customerCode(row[0], index),
      name,
      short_name: name,
      customer_group: "CUA_HANG",
      credit_limit: 0,
      credit_days: 0,
      current_debt: 0,
      total_revenue: 0,
      status: "ACTIVE",
      note: `Import từ sheet ${sheet}`,
      updated_at: new Date().toISOString()
    };
  })
  .filter(Boolean);

if (customers.length === 0) throw new Error(`Không tìm thấy khách hàng hợp lệ trong sheet ${sheet}.`);

const { error } = await supabase.from("customers").upsert(customers, { onConflict: "code" });
if (error) throw new Error(`customers: ${error.message}`);

const { data: savedCustomers, error: savedError } = await supabase
  .from("customers")
  .select("id,code,name")
  .in("code", customers.map((customer) => customer.code))
  .order("code", { ascending: true });
if (savedError) throw new Error(`customers select: ${savedError.message}`);

const { data: batch } = await supabase
  .from("import_batches")
  .insert({
    entity_type: "customers",
    file_name: workbookPath,
    total_rows: rows.length - 1,
    success_rows: customers.length,
    failed_rows: Math.max(0, rows.length - 1 - customers.length),
    status: "COMPLETED",
    completed_at: new Date().toISOString()
  })
  .select("id")
  .single();

console.log(JSON.stringify({
  ok: true,
  sheet,
  customers: savedCustomers?.length ?? customers.length,
  sample: savedCustomers?.slice(0, 5) ?? [],
  batchId: batch?.id
}, null, 2));
