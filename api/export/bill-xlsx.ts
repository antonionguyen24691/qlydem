import writeXlsxFile from "write-excel-file/node";
import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

function text(value: unknown, options: Record<string, unknown> = {}) {
  return {
    value: value === null || value === undefined ? "" : String(value),
    ...options
  };
}

async function loadSetting(key: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    await requireAuth(req, ["ADMIN", "ACCOUNTANT", "SALE", "WAREHOUSE"]);
    const orderCode = getQueryValue(req.query?.order) ?? getQueryValue(req.query?.code);
    if (!orderCode) {
      res.status(400).json({ ok: false, error: "Thiếu mã đơn cần xuất XLSX." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select("*")
      .or(`code.eq.${orderCode},id.eq.${orderCode}`)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) {
      res.status(404).json({ ok: false, error: "Không tìm thấy đơn hàng." });
      return;
    }

    const [{ data: items, error: itemError }, { data: customer }, branding, payment] = await Promise.all([
      supabase.from("sales_order_items").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
      order.customer_id ? supabase.from("customers").select("*").eq("id", order.customer_id).maybeSingle() : Promise.resolve({ data: null }),
      loadSetting("branding"),
      loadSetting("payment")
    ]);
    if (itemError) throw new Error(itemError.message);

    const companyName = branding.companyName || branding.appName || "PMQL";
    const debt = Math.max(0, Number(order.total_amount ?? 0) - Number(order.paid_amount ?? 0));
    const rows = [
      [text(companyName, { fontWeight: "bold", fontSize: 16 }), null, null, null, null, text(`Số phiếu: ${order.code}`, { fontWeight: "bold" })],
      [text(branding.address ? `Địa chỉ: ${branding.address}` : ""), null, null, null, null, text(`Ngày: ${new Date(order.order_date ?? order.created_at).toLocaleDateString("vi-VN")}`)],
      [text(branding.hotline ? `Hotline: ${branding.hotline}` : ""), null, null, null, null, text(`Trạng thái: ${order.status ?? ""}`)],
      [],
      [text("PHIẾU XUẤT BÁN HÀNG", { fontWeight: "bold", fontSize: 18, align: "center" })],
      [],
      [text("Bên mua", { fontWeight: "bold" }), text(customer?.name ?? "Khách lẻ"), null, text("SĐT", { fontWeight: "bold" }), text(customer?.phone ?? "")],
      [text("Địa chỉ", { fontWeight: "bold" }), text(customer?.address ?? "")],
      [],
      [
        text("STT", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("Mã hàng", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("Tên hàng", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("ĐVT", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("SL", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("Đơn giá", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" }),
        text("Thành tiền", { fontWeight: "bold", align: "center", backgroundColor: "#E5E7EB" })
      ],
      ...(items ?? []).map((item: any, index: number) => [
        text(index + 1, { align: "center" }),
        text(item.product_code ?? ""),
        text(item.product_name ?? ""),
        text(item.unit ?? "", { align: "center" }),
        text(money(item.quantity), { align: "right" }),
        text(money(item.unit_price), { align: "right" }),
        text(money(item.line_total), { align: "right", fontWeight: "bold" })
      ]),
      [],
      [null, null, null, null, null, text("Tổng cộng", { fontWeight: "bold" }), text(`${money(order.total_amount)} đ`, { align: "right", fontWeight: "bold" })],
      [null, null, null, null, null, text("Đã thu", { fontWeight: "bold" }), text(`${money(order.paid_amount)} đ`, { align: "right", fontWeight: "bold" })],
      [null, null, null, null, null, text("Còn nợ", { fontWeight: "bold" }), text(`${money(debt)} đ`, { align: "right", fontWeight: "bold" })],
      [],
      [text("Thông tin thanh toán", { fontWeight: "bold" })],
      [text(payment.enabled ? `Ngân hàng/BIN: ${payment.bankBin ?? ""} | STK: ${payment.accountNumber ?? ""} | Chủ TK: ${payment.accountName ?? ""}` : "Chưa bật QR thanh toán")],
      [text(`Nội dung CK: ${(payment.transferTemplate || "Thanh toan {orderCode}").replaceAll("{orderCode}", order.code).replaceAll("{customerName}", customer?.name ?? "Khach le")}`)],
      [],
      [],
      [text("Kế toán/Bên giao hàng", { fontWeight: "bold", align: "center" }), null, text("Người giao hàng", { fontWeight: "bold", align: "center" }), null, text("Bên nhận hàng", { fontWeight: "bold", align: "center" })],
      [text("(Ký, ghi rõ họ tên)", { align: "center" }), null, text("(Ký, ghi rõ họ tên)", { align: "center" }), null, text("(Ký, ghi rõ họ tên)", { align: "center" })],
      [],
      [],
      [],
      [text("................................", { align: "center" }), null, text("................................", { align: "center" }), null, text("................................", { align: "center" })]
    ];

    const workbook = await writeXlsxFile([{
      sheet: "phieu-xuat-kho",
      data: rows,
      columns: [
        { width: 8 },
        { width: 16 },
        { width: 36 },
        { width: 10 },
        { width: 12 },
        { width: 16 },
        { width: 18 }
      ]
    }]);
    const buffer = await workbook.toBuffer();
    const filename = `phieu-xuat-${order.code}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}
