import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { createCode, getJsonBody, optionalString, toNumber, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requireAuth } from "../_lib/auth.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

type OrderPayloadItem = {
  productId?: string;
  productCode?: string;
  productName?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  vatRate?: number;
};

type OrderPayload = {
  code?: string;
  customerId?: string;
  saleId?: string;
  warehouseId?: string;
  paymentMethod?: string;
  paidAmount?: number;
  discountAmount?: number;
  vatAmount?: number;
  dueDate?: string;
  assignedTo?: string;
  note?: string;
  items?: OrderPayloadItem[];
};

async function getCustomerDebt(customerId?: string) {
  if (!customerId) return 0;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("current_debt")
    .eq("id", customerId)
    .single();
  if (error) return 0;
  return toNumber(data?.current_debt);
}

async function resolveWarehouseId(input?: string) {
  if (input) return input;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("warehouses")
    .select("id")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id as string | undefined;
}

async function applyInventoryChanges(
  warehouseId: string | undefined,
  orderId: string,
  orderCode: string,
  items: Array<{ product_id?: string; quantity: number }>
) {
  if (!warehouseId) return;
  const supabase = getSupabaseAdmin();

  for (const item of items) {
    if (!item.product_id) continue;
    const { data: balance } = await supabase
      .from("inventory_balances")
      .select("id,quantity_box")
      .eq("warehouse_id", warehouseId)
      .eq("product_id", item.product_id)
      .maybeSingle();

    const stockAfter = toNumber(balance?.quantity_box) - item.quantity;
    if (balance?.id) {
      await supabase
        .from("inventory_balances")
        .update({ quantity_box: stockAfter, updated_at: new Date().toISOString() })
        .eq("id", balance.id);
    } else {
      await supabase.from("inventory_balances").insert({
        warehouse_id: warehouseId,
        product_id: item.product_id,
        quantity_box: stockAfter,
        quantity_piece: 0
      });
    }

    await supabase.from("inventory_transactions").insert({
      warehouse_id: warehouseId,
      product_id: item.product_id,
      source_type: "SALES_ORDER",
      source_id: orderId,
      quantity_change: -item.quantity,
      stock_after: stockAfter,
      note: `Xuất bán đơn ${orderCode}`
    });
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const user = await requireAuth(req, ["ADMIN", "ACCOUNTANT", "SALE"]);
    const body = getJsonBody<OrderPayload>(req);
    const items = body.items ?? [];
    if (items.length === 0) {
      res.status(400).json({ ok: false, error: "Đơn hàng phải có ít nhất một sản phẩm." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice), 0);
    const discountAmount = toNumber(body.discountAmount);
    const vatAmount = toNumber(body.vatAmount);
    const totalAmount = Math.max(0, subtotal - discountAmount + vatAmount);
    const paidAmount = Math.min(totalAmount, Math.max(0, toNumber(body.paidAmount)));
    const debtAmount = Math.max(0, totalAmount - paidAmount);
    const code = body.code ?? createCode("HD");
    const customerId = optionalString(body.customerId);
    const paymentMethod = toStringValue(body.paymentMethod, debtAmount > 0 ? "DEBT" : "CASH");
    const warehouseId = await resolveWarehouseId(optionalString(body.warehouseId));
    if (!customerId && debtAmount > 0) {
      res.status(400).json({ ok: false, error: "Đơn ghi nợ phải chọn khách hàng." });
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .insert({
        code,
        customer_id: customerId,
        sale_id: optionalString(body.saleId) ?? user.id,
        subtotal,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        debt_amount: debtAmount,
        payment_method: paymentMethod,
        status: "COMPLETED",
        note: optionalString(body.note)
      })
      .select("*")
      .single();

    if (orderError) throw new Error(orderError.message);

    const itemRows = items.map((item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      const itemDiscount = toNumber(item.discountAmount);
      const vatRate = toNumber(item.vatRate);
      return {
        order_id: order.id,
        product_id: optionalString(item.productId),
        product_code: optionalString(item.productCode),
        product_name: toStringValue(item.productName, "Sản phẩm"),
        unit: optionalString(item.unit),
        quantity,
        unit_price: unitPrice,
        discount_amount: itemDiscount,
        vat_rate: vatRate,
        line_total: Math.max(0, quantity * unitPrice - itemDiscount)
      };
    });

    const { error: itemError } = await supabase.from("sales_order_items").insert(itemRows);
    if (itemError) throw new Error(itemError.message);

    let debt = null;
    if (customerId) {
      const { data: debtRow, error: debtError } = await supabase
        .from("order_debts")
        .insert({
          order_id: order.id,
          customer_id: customerId,
          sale_id: optionalString(body.saleId) ?? user.id,
          original_amount: totalAmount,
          paid_amount: paidAmount,
          remaining_amount: debtAmount,
          due_date: optionalString(body.dueDate),
          assigned_to: optionalString(body.assignedTo) ?? optionalString(body.saleId) ?? user.id,
          status: debtAmount > 0 ? "OPEN" : "CLOSED",
          closed_at: debtAmount > 0 ? undefined : new Date().toISOString()
        })
        .select("*")
        .single();

      if (debtError) throw new Error(debtError.message);
      debt = debtRow;

      if (debtAmount > 0) {
        const scheduledAt = optionalString(body.dueDate) ?? new Date().toISOString();
        const title = `Nhắc công nợ ${code}`;
        const message = `Khách hàng còn nợ ${debtAmount.toLocaleString("vi-VN")} đ từ đơn ${code}.`;
        await supabase.from("debt_reminders").insert({
          order_debt_id: debtRow.id,
          customer_id: customerId,
          assigned_to: optionalString(body.assignedTo) ?? optionalString(body.saleId) ?? user.id,
          reminder_type: "DEBT_DUE",
          channel: "APP",
          scheduled_at: scheduledAt,
          status: "PENDING",
          title,
          message,
          created_by: user.id
        });
        await supabase.from("notifications").insert({
          user_id: optionalString(body.assignedTo) ?? optionalString(body.saleId) ?? user.id,
          type: "DEBT_DUE",
          title,
          body: message,
          entity_type: "customer_debt",
          entity_id: debtRow.id
        });
      }
    }

    let balanceAfter = customerId ? await getCustomerDebt(customerId) : 0;
    if (customerId) {
      balanceAfter += totalAmount;
      await supabase.from("customer_debt_ledger").insert({
        customer_id: customerId,
        order_id: order.id,
        source_type: "INVOICE",
        source_id: order.id,
        debit: totalAmount,
        credit: 0,
        balance_after: balanceAfter,
        due_date: optionalString(body.dueDate),
        status: debtAmount > 0 ? "OPEN" : "CLOSED",
        note: `Ghi nhận đơn ${code}`
      });
    }

    let receipt = null;
    if (paidAmount > 0 && customerId) {
      const { data: receiptRow, error: receiptError } = await supabase
        .from("receipts")
        .insert({
          code: createCode("PT"),
          customer_id: customerId,
          order_id: order.id,
          amount: paidAmount,
          payment_method: paymentMethod === "DEBT" ? "CASH" : paymentMethod,
          note: `Thu tiền đơn ${code}`
        })
        .select("*")
        .single();
      if (receiptError) throw new Error(receiptError.message);
      receipt = receiptRow;

      if (debt) {
        await supabase.from("receipt_allocations").insert({
          receipt_id: receiptRow.id,
          order_debt_id: debt.id,
          order_id: order.id,
          customer_id: customerId,
          amount: paidAmount,
        allocated_by: optionalString(body.saleId) ?? user.id
        });
      }

      balanceAfter -= paidAmount;
      await supabase.from("customer_debt_ledger").insert({
        customer_id: customerId,
        order_id: order.id,
        source_type: "RECEIPT",
        source_id: receiptRow.id,
        debit: 0,
        credit: paidAmount,
        balance_after: balanceAfter,
        status: debtAmount > 0 ? "OPEN" : "CLOSED",
        note: `Thu tiền đơn ${code}`
      });

      await supabase.from("cashbook_entries").insert({
        code: createCode("TM"),
        account_type: paymentMethod === "TRANSFER" ? "BANK" : "CASH",
        direction: "IN",
        source_type: "RECEIPT",
        source_id: receiptRow.id,
        amount: paidAmount,
        payment_method: paymentMethod,
        note: `Thu tiền đơn ${code}`,
        created_by: optionalString(body.saleId) ?? user.id
      });
    }

    if (paidAmount > 0 && !customerId) {
      await supabase.from("cashbook_entries").insert({
        code: createCode("TM"),
        account_type: paymentMethod === "TRANSFER" ? "BANK" : "CASH",
        direction: "IN",
        source_type: "SALES_ORDER",
        source_id: order.id,
        amount: paidAmount,
        payment_method: paymentMethod,
        note: `Thu tiền khách lẻ đơn ${code}`,
        created_by: optionalString(body.saleId) ?? user.id
      });
    }

    if (customerId) {
      await supabase
        .from("customers")
        .update({
          current_debt: debtAmount > 0 ? balanceAfter : Math.max(0, balanceAfter),
          last_order_at: new Date().toISOString()
        })
        .eq("id", customerId);
    }

    await applyInventoryChanges(warehouseId, order.id, code, itemRows);

    await supabase.from("audit_logs").insert({
      actor_id: optionalString(body.saleId) ?? user.id,
      action: "CREATE",
      entity_type: "sales_order",
      entity_id: order.id,
      after_json: { order, items: itemRows, debt, receipt }
    });

    await bestEffortSyncTables([
      "sales_orders",
      "sales_order_items",
      "customers",
      "customer_debt_ledger",
      "order_debts",
      "receipts",
      "receipt_allocations",
      "cashbook_entries",
      "debt_reminders",
      "inventory_balances",
      "inventory_transactions"
    ]);

    res.status(200).json({ ok: true, order, items: itemRows, debt, receipt });
  } catch (error) {
    sendError(res, error);
  }
}
