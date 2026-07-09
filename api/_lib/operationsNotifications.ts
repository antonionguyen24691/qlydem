import type { ApiRequest, ApiResponse } from "./http.js";
import { methodNotAllowed, sendError } from "./http.js";
import { requirePermission } from "./auth.js";
import { getSupabaseAdmin } from "./supabase.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firstRelated<T extends Record<string, unknown>>(value: T | T[] | null | undefined): T {
  if (Array.isArray(value)) return value[0] ?? ({} as T);
  return value ?? ({} as T);
}

async function isCron(req: ApiRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers?.authorization ?? req.headers?.Authorization;
  const actual = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  return Boolean(expected && actual === `Bearer ${expected}`);
}

async function existingNotificationKeys() {
  const supabase = getSupabaseAdmin();
  const start = `${todayKey()}T00:00:00.000Z`;
  const { data, error } = await supabase
    .from("notifications")
    .select("type,entity_type,entity_id,created_at")
    .gte("created_at", start);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((item: any) => `${item.type}:${item.entity_type}:${item.entity_id}`));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!["GET", "POST"].includes(req.method ?? "")) return methodNotAllowed(res, ["GET", "POST"]);

  try {
    if (!(await isCron(req))) {
      await requirePermission(req, "settings.manage");
    }

    const supabase = getSupabaseAdmin();
    const keys = await existingNotificationKeys();
    const rows: Array<Record<string, unknown>> = [];

    const { data: debtRows, error: debtError } = await supabase
      .from("order_debts")
      .select("id,customer_id,sale_id,remaining_amount,next_reminder_at,status,sales_orders(code),customers(name)")
      .gt("remaining_amount", 0)
      .in("status", ["OPEN", "PARTIAL"])
      .limit(100);
    if (debtError) throw new Error(debtError.message);

    for (const debt of debtRows ?? []) {
      const order = firstRelated(debt.sales_orders);
      const customer = firstRelated(debt.customers);
      const reminderAt = debt.next_reminder_at ? new Date(debt.next_reminder_at).getTime() : 0;
      if (reminderAt > Date.now()) continue;
      const entityId = debt.id;
      const key = `DEBT_DUE:customer_debt:${entityId}`;
      if (keys.has(key)) continue;
      rows.push({
        user_id: debt.sale_id ?? null,
        type: "DEBT_DUE",
        title: `Nhắc công nợ ${order.code ?? ""}`.trim(),
        body: `${customer.name ?? "Khách hàng"} còn nợ ${Number(debt.remaining_amount ?? 0).toLocaleString("vi-VN")} đ.`,
        entity_type: "customer_debt",
        entity_id: entityId
      });
    }

    const { data: stockRows, error: stockError } = await supabase
      .from("inventory_balances")
      .select("id,quantity_box,min_stock_level,products(code,product_name,unit)")
      .limit(100);
    if (stockError) throw new Error(stockError.message);

    for (const stock of stockRows ?? []) {
      const product = firstRelated(stock.products);
      const quantity = Number(stock.quantity_box ?? 0);
      const minStock = Number(stock.min_stock_level ?? 0);
      if (quantity > 0 && (minStock <= 0 || quantity > minStock)) continue;
      const key = `LOW_STOCK:inventory:${stock.id}`;
      if (keys.has(key)) continue;
      rows.push({
        user_id: null,
        type: "LOW_STOCK",
        title: `Tồn kho thấp ${product.code ?? ""}`.trim(),
        body: `${product.product_name ?? "Hàng hóa"} còn ${quantity.toLocaleString("vi-VN")} ${product.unit ?? ""}.`,
        entity_type: "inventory",
        entity_id: stock.id
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw new Error(error.message);
    }

    res.status(200).json({
      ok: true,
      created: rows.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, error);
  }
}
