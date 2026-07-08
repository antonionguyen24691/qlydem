import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { methodNotAllowed, sendError } from "../_lib/http.js";
import { createCode, getJsonBody, optionalString, toNumber, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { requireAuth } from "../_lib/auth.js";
import { bestEffortSyncTables } from "../_lib/googleSheets.js";

type ReceiptAllocationInput = {
  orderDebtId?: string;
  amount?: number;
};

type ReceiptPayload = {
  customerId?: string;
  amount?: number;
  paymentMethod?: string;
  note?: string;
  createdBy?: string;
  allocations?: ReceiptAllocationInput[];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const user = await requireAuth(req, ["ADMIN", "ACCOUNTANT", "SALE"]);
    const body = getJsonBody<ReceiptPayload>(req);
    const customerId = optionalString(body.customerId);
    const amount = toNumber(body.amount);
    if (!customerId || amount <= 0) {
      res.status(400).json({ ok: false, error: "Thiếu khách hàng hoặc số tiền thu không hợp lệ." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("current_debt")
      .eq("id", customerId)
      .single();
    if (customerError) throw new Error(customerError.message);

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        code: createCode("PT"),
        customer_id: customerId,
        amount,
        payment_method: toStringValue(body.paymentMethod, "CASH"),
        note: optionalString(body.note),
        created_by: optionalString(body.createdBy) ?? user.id
      })
      .select("*")
      .single();
    if (receiptError) throw new Error(receiptError.message);

    let remainingToAllocate = amount;
    let debtsToAllocate: Array<{ id: string; order_id: string; remaining_amount: number; paid_amount: number }> = [];

    if (body.allocations?.length) {
      const debtIds = body.allocations.map((item) => item.orderDebtId).filter(Boolean);
      const { data, error } = await supabase
        .from("order_debts")
        .select("id,order_id,remaining_amount,paid_amount")
        .in("id", debtIds);
      if (error) throw new Error(error.message);
      debtsToAllocate = data ?? [];
    } else {
      const { data, error } = await supabase
        .from("order_debts")
        .select("id,order_id,remaining_amount,paid_amount")
        .eq("customer_id", customerId)
        .eq("status", "OPEN")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      debtsToAllocate = data ?? [];
    }

    const allocationRows = [];
    for (const debt of debtsToAllocate) {
      const requested = body.allocations?.find((item) => item.orderDebtId === debt.id)?.amount;
      const allocationAmount = Math.min(
        toNumber(debt.remaining_amount),
        requested ? toNumber(requested) : remainingToAllocate,
        remainingToAllocate
      );
      if (allocationAmount <= 0 || remainingToAllocate <= 0) continue;

      remainingToAllocate -= allocationAmount;
      const nextPaid = toNumber(debt.paid_amount) + allocationAmount;
      const nextRemaining = Math.max(0, toNumber(debt.remaining_amount) - allocationAmount);

      await supabase
        .from("order_debts")
        .update({
          paid_amount: nextPaid,
          remaining_amount: nextRemaining,
          status: nextRemaining > 0 ? "OPEN" : "CLOSED",
          closed_at: nextRemaining > 0 ? undefined : new Date().toISOString()
        })
        .eq("id", debt.id);

      allocationRows.push({
        receipt_id: receipt.id,
        order_debt_id: debt.id,
        order_id: debt.order_id,
        customer_id: customerId,
        amount: allocationAmount,
        allocated_by: optionalString(body.createdBy) ?? user.id
      });
    }

    if (allocationRows.length > 0) await supabase.from("receipt_allocations").insert(allocationRows);

    const newDebt = Math.max(0, toNumber(customer.current_debt) - amount);
    await supabase.from("customer_debt_ledger").insert({
      customer_id: customerId,
      source_type: "RECEIPT",
      source_id: receipt.id,
      debit: 0,
      credit: amount,
      balance_after: newDebt,
      status: "CLOSED",
      note: optionalString(body.note) ?? "Thu tiền khách hàng"
    });

    await supabase.from("customers").update({ current_debt: newDebt }).eq("id", customerId);
    await supabase.from("cashbook_entries").insert({
      code: createCode("TM"),
      account_type: body.paymentMethod === "TRANSFER" ? "BANK" : "CASH",
      direction: "IN",
      source_type: "RECEIPT",
      source_id: receipt.id,
      amount,
      payment_method: toStringValue(body.paymentMethod, "CASH"),
      note: optionalString(body.note),
      created_by: optionalString(body.createdBy) ?? user.id
    });

    await supabase.from("audit_logs").insert({
      actor_id: optionalString(body.createdBy) ?? user.id,
      action: "CREATE",
      entity_type: "receipt",
      entity_id: receipt.id,
      after_json: { receipt, allocations: allocationRows }
    });

    await bestEffortSyncTables([
      "receipts",
      "receipt_allocations",
      "customers",
      "customer_debt_ledger",
      "order_debts",
      "cashbook_entries"
    ]);

    res.status(200).json({ ok: true, receipt, allocations: allocationRows, unallocatedAmount: remainingToAllocate });
  } catch (error) {
    sendError(res, error);
  }
}
