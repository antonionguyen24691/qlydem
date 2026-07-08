import { existsSync, readFileSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readSheet } from "read-excel-file/node";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local", quiet: true });

const workbookPath = process.argv[2] || "NHAT KY BAN HANG.xlsx";
const sheet = process.argv[3] || "KHO HANG";
const warehouseCode = process.env.PMQL_IMPORT_WAREHOUSE_CODE || "KHO-CHINH";
const warehouseName = process.env.PMQL_IMPORT_WAREHOUSE_NAME || "Kho chính";

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

function toText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeSize(value) {
  return toText(value).replace(/\*/g, "x");
}

function productCategory(name) {
  const text = name.toLowerCase();
  if (text.includes("gạch")) return "Gạch";
  return "Hàng hóa";
}

const rows = await readSheet(readFileSync(workbookPath), sheet);
const [headers, ...body] = rows;
const headerIndex = new Map(headers.map((header, index) => [toText(header).toLowerCase(), index]));

function value(row, header) {
  return row[headerIndex.get(header.toLowerCase())];
}

const productByCode = new Map();
for (const row of body) {
  const code = toText(value(row, "Mã hàng"));
  const productName = toText(value(row, "Tên vật tư"));
  if (!code || !productName || code.startsWith("#") || productName.startsWith("#")) continue;

  productByCode.set(code, {
    code,
    invoice_name: toText(value(row, "Tên trên Hđ")) || productName,
    product_name: productName,
    product_type: "MERCHANDISE",
    category: productCategory(productName),
    size: normalizeSize(value(row, "Kích thước")),
    unit: "HỘP",
    m2_per_box: toNumber(value(row, "M2")),
    pieces_per_box: toNumber(value(row, "SỐ V TRONG HỘP")),
    price_by_m2: toNumber(value(row, "GIÁ THEO M2")),
    sell_price_box_vat: toNumber(value(row, "GIÁ HỘP VAT")),
    cost_price: 0,
    vat_rate: 0,
    status: "ACTIVE",
    lifecycle_status: "ACTIVE",
    updated_at: new Date().toISOString()
  });
}

const products = [...productByCode.values()];
if (products.length === 0) throw new Error(`Không tìm thấy hàng hóa hợp lệ trong sheet ${sheet}.`);

const { data: warehouse, error: warehouseError } = await supabase
  .from("warehouses")
  .upsert(
    { code: warehouseCode, name: warehouseName, status: "ACTIVE", updated_at: new Date().toISOString() },
    { onConflict: "code" }
  )
  .select("id,code")
  .single();
if (warehouseError) throw new Error(`warehouses: ${warehouseError.message}`);

const { error: productError } = await supabase.from("products").upsert(products, { onConflict: "code" });
if (productError) throw new Error(`products: ${productError.message}`);

const { data: savedProducts, error: savedProductError } = await supabase
  .from("products")
  .select("id,code")
  .in("code", products.map((product) => product.code));
if (savedProductError) throw new Error(`products select: ${savedProductError.message}`);

const balances = (savedProducts ?? []).map((product) => ({
  warehouse_id: warehouse.id,
  product_id: product.id,
  quantity_box: 0,
  quantity_piece: 0,
  min_stock_level: 0,
  updated_at: new Date().toISOString()
}));

const { error: balanceError } = await supabase
  .from("inventory_balances")
  .upsert(balances, { onConflict: "warehouse_id,product_id", ignoreDuplicates: true });
if (balanceError) throw new Error(`inventory_balances: ${balanceError.message}`);

const { data: batch } = await supabase
  .from("import_batches")
  .insert({
    entity_type: "products",
    file_name: workbookPath,
    total_rows: body.length,
    success_rows: products.length,
    failed_rows: Math.max(0, body.length - products.length),
    status: "COMPLETED",
    completed_at: new Date().toISOString()
  })
  .select("id")
  .single();

console.log(JSON.stringify({
  ok: true,
  sheet,
  warehouse: warehouse.code,
  products: products.length,
  inventoryBalances: balances.length,
  batchId: batch?.id
}, null, 2));
