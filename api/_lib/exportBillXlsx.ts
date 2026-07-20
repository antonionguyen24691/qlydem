import writeXlsxFile from "write-excel-file/node";
import type { ApiRequest, ApiResponse } from "./http.js";
import { getQueryValue, methodNotAllowed, sendError } from "./http.js";
import { requireAuth } from "./auth.js";
import { getSupabaseAdmin } from "./supabase.js";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

function text(value: unknown, options: Record<string, unknown> = {}) {
  return {
    value: value === null || value === undefined ? "" : String(value),
    ...options
  };
}

function amount(value: unknown, options: Record<string, unknown> = {}) {
  return {
    value: Number(value ?? 0),
    type: Number,
    format: '#,##0 "đ"',
    ...options
  };
}

async function loadSetting(key: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? {};
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
    let orderQuery = supabase
      .from("sales_orders")
      .select("*")
      .eq("code", orderCode);
    if (isUuid(orderCode)) {
      orderQuery = supabase
        .from("sales_orders")
        .select("*")
        .or(`code.eq.${orderCode},id.eq.${orderCode}`);
    }
    const { data: order, error: orderError } = await orderQuery.maybeSingle();
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
    const subtotal = Number(order.subtotal ?? order.total_amount ?? 0);
    const discount = Math.max(0, Number(order.discount_amount ?? 0));
    const total = Number(order.total_amount ?? 0);
    const paid = Math.min(total, Math.max(0, Number(order.paid_amount ?? 0)));
    const debt = Math.max(0, total - paid);
    const thinBorder = { borderColor: "#94A3B8", borderStyle: "thin" };
    const infoLabel = { ...thinBorder, fontWeight: "bold", backgroundColor: "#F8FAFC", alignVertical: "center" };
    const infoValue = { ...thinBorder, alignVertical: "center", wrap: true };
    const tableHeader = { borderColor: "#475569", borderStyle: "thin", fontWeight: "bold", align: "center", alignVertical: "center", backgroundColor: "#E2E8F0", wrap: true };
    const tableCell = { ...thinBorder, alignVertical: "center", wrap: true };
    const rows = [
      [text(companyName, { fontWeight: "bold", fontSize: 14, columnSpan: 7, height: 22, wrap: true }), null, null, null, null, null, null],
      [text(`Địa chỉ: ${branding.address || "-"}`, { columnSpan: 7, height: 20, wrap: true }), null, null, null, null, null, null],
      [],
      [text("PHIẾU XUẤT BÁN HÀNG", { fontWeight: "bold", fontSize: 16, align: "center", columnSpan: 7, height: 28 }), null, null, null, null, null, null],
      [],
      [text(`Số phiếu: ${order.code}`, { ...infoValue, columnSpan: 7, fontWeight: "bold", height: 20, wrap: true }), null, null, null, null, null, null],
      [text(`Ngày: ${new Date(order.order_date ?? order.created_at).toLocaleDateString("vi-VN")}`, { ...infoValue, columnSpan: 7, height: 20 }), null, null, null, null, null, null],
      [text("Bên bán:", infoLabel), text(`${companyName}${branding.hotline ? ` | SĐT: ${branding.hotline}` : ""}`, { ...infoValue, columnSpan: 6, height: 24, wrap: true }), null, null, null, null, null],
      [text("Địa chỉ:", infoLabel), text(branding.address || "-", { ...infoValue, columnSpan: 6, height: 30, wrap: true }), null, null, null, null, null],
      [text("Bên mua:", infoLabel), text(`${customer?.name ?? "Khách lẻ"}${customer?.phone ? ` | SĐT: ${customer.phone}` : ""}`, { ...infoValue, columnSpan: 6, height: 24, wrap: true }), null, null, null, null, null],
      [text("Địa chỉ:", infoLabel), text(customer?.address || "-", { ...infoValue, columnSpan: 6, height: 30, wrap: true }), null, null, null, null, null],
      [],
      [
        text("STT", tableHeader), text("Mã hàng", tableHeader), text("Tên hàng", tableHeader), text("ĐVT", tableHeader),
        text("SL", tableHeader), text("Đơn giá", tableHeader), text("Thành tiền", tableHeader)
      ],
      ...(items ?? []).map((item: any, index: number) => [
        text(index + 1, { ...tableCell, align: "center" }), text(item.product_code ?? "", tableCell), text(item.lot_code ? `${item.product_name ?? ""} (Lô: ${item.lot_code})` : (item.product_name ?? ""), tableCell),
        text(item.unit ?? "", { ...tableCell, align: "center" }), amount(item.quantity, { ...tableCell, align: "right", format: "#,##0.##" }),
        amount(item.unit_price, { ...tableCell, align: "right" }), amount(item.line_total, { ...tableCell, align: "right", fontWeight: "bold" })
      ]),
      [null, null, null, null, null, text("Tạm tính", infoLabel), amount(subtotal, { ...infoValue, align: "right", fontWeight: "bold" })],
      [null, null, null, null, null, text("Chiết khấu", infoLabel), amount(discount, { ...infoValue, align: "right", textColor: "#DC2626" })],
      [null, null, null, null, null, text("Tổng cộng", { ...infoLabel, fontWeight: "bold" }), amount(total, { ...infoValue, align: "right", fontWeight: "bold" })],
      [null, null, null, null, null, text("Đã thu", infoLabel), amount(paid, { ...infoValue, align: "right", fontWeight: "bold", textColor: "#047857" })],
      [null, null, null, null, null, text("Còn phải thu", infoLabel), amount(debt, { ...infoValue, align: "right", fontWeight: "bold", textColor: debt > 0 ? "#DC2626" : "#047857" })],
      [],
      [text("Thông tin thanh toán", { ...infoLabel, columnSpan: 7 }), null, null, null, null, null, null],
      [text(payment.enabled ? `Ngân hàng: ${payment.bankBin ?? "-"} | STK: ${payment.accountNumber ?? "-"} | Chủ TK: ${payment.accountName ?? "-"}` : "Chưa bật QR thanh toán", { ...infoValue, columnSpan: 7, wrap: true }), null, null, null, null, null, null],
      [text(`Nội dung CK: ${(payment.transferTemplate || "Thanh toan {orderCode}").replaceAll("{orderCode}", order.code).replaceAll("{customerName}", customer?.name ?? "Khach le")}`, { ...infoValue, columnSpan: 7, wrap: true }), null, null, null, null, null, null],
      [],
      [text("Người lập phiếu", { fontWeight: "bold", align: "center", columnSpan: 2 }), null, text("Người giao hàng", { fontWeight: "bold", align: "center", columnSpan: 3 }), null, null, text("Bên nhận hàng", { fontWeight: "bold", align: "center", columnSpan: 2 }), null],
      [text("(Ký, ghi rõ họ tên)", { align: "center", columnSpan: 2 }), null, text("(Ký, ghi rõ họ tên)", { align: "center", columnSpan: 3 }), null, null, text("(Ký, ghi rõ họ tên)", { align: "center", columnSpan: 2 }), null],
      [], [],
      [text("........................", { align: "center", columnSpan: 2 }), null, text("........................", { align: "center", columnSpan: 3 }), null, null, text("........................", { align: "center", columnSpan: 2 }), null]
    ];

    const workbook = await writeXlsxFile([{
      sheet: "phieu-xuat-kho",
      data: rows,
      showGridLines: false,
      zoomScale: 1.05,
      columns: [
        { width: 12 }, { width: 15 }, { width: 26 }, { width: 8 }, { width: 8 }, { width: 13 }, { width: 15 }
      ]
    }], { fontFamily: "Arial", fontSize: 10 });
    const buffer = await workbook.toBuffer();
    const filename = `phieu-xuat-${order.code}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}
