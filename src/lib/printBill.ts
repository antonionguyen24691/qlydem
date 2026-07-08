import type { Order } from "../store/data";

type CompanyInfo = {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  taxCode?: string;
};

type PaymentSettings = {
  enabled?: boolean;
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
  transferTemplate?: string;
};

const defaultCompany: Required<CompanyInfo> = {
  name: "CÔNG TY GẠCH MEN SANG PHÁT",
  address: "07 Lê Trọng Tấn",
  phone: "",
  logoUrl: "",
  taxCode: ""
};

function money(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")} đ`;
}

function numberText(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orderDate(order: Order) {
  const parsed = new Date(order.date);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(order.date);
  return parsed.toLocaleDateString("vi-VN");
}

async function loadPaymentSettings(): Promise<PaymentSettings> {
  try {
    const response = await fetch("/api/settings?key=payment");
    const body = await response.json();
    return body.payment ?? {};
  } catch {
    return {};
  }
}

async function loadCompanySettings(): Promise<CompanyInfo> {
  try {
    const response = await fetch("/api/settings?key=branding");
    const body = await response.json();
    const branding = body.branding ?? {};
    return {
      name: branding.companyName || branding.appName,
      address: branding.address,
      phone: branding.hotline,
      logoUrl: branding.logoUrl,
      taxCode: branding.taxCode
    };
  } catch {
    return {};
  }
}

function transferContent(payment: PaymentSettings, order: Order) {
  return (payment.transferTemplate || "Thanh toan {orderCode}")
    .replaceAll("{orderCode}", order.id)
    .replaceAll("{customerName}", order.customerName);
}

function vietQrUrl(payment: PaymentSettings, order: Order) {
  if (!payment.enabled || !payment.bankBin || !payment.accountNumber) return "";
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(order.total - order.paid || order.total))),
    addInfo: transferContent(payment, order),
    accountName: payment.accountName ?? ""
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(payment.bankBin)}-${encodeURIComponent(payment.accountNumber)}-compact2.png?${params.toString()}`;
}

function billHtml(order: Order, company: CompanyInfo = {}, payment: PaymentSettings = {}) {
  const info = { ...defaultCompany, ...company };
  const debt = Math.max(0, order.total - order.paid);
  const qrUrl = vietQrUrl(payment, order);
  const content = transferContent(payment, order);
  const rows = order.items.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        ${item.size ? `<div class="muted">${escapeHtml(item.size)}</div>` : ""}
      </td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="right">${numberText(item.quantity)}</td>
      <td class="right">${money(item.price)}</td>
      <td class="right">${money(item.total)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Phiếu xuất bán hàng ${escapeHtml(order.id)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
    .toolbar button { border: 1px solid #d1d5db; border-radius: 8px; background: #fff; padding: 8px 12px; font-weight: 700; cursor: pointer; }
    .toolbar .primary { background: #059669; border-color: #059669; color: white; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .company { display: flex; gap: 12px; align-items: center; }
    .logo { width: 54px; height: 54px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 6px; }
    .company-name { font-weight: 700; font-size: 15px; text-transform: uppercase; }
    .muted { color: #6b7280; font-size: 12px; margin-top: 2px; }
    .meta { min-width: 190px; border: 1px solid #111827; padding: 8px 10px; line-height: 1.7; }
    h1 { text-align: center; font-size: 22px; margin: 24px 0 6px; letter-spacing: .02em; }
    .date { text-align: center; margin-bottom: 18px; }
    .customer { display: grid; grid-template-columns: 92px 1fr; gap: 7px 10px; margin-bottom: 14px; }
    .line { border-bottom: 1px dotted #6b7280; min-height: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #111827; padding: 7px 8px; vertical-align: top; }
    th { text-align: center; background: #f3f4f6; font-size: 12px; text-transform: uppercase; }
    .center { text-align: center; }
    .right { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; margin-top: 12px; width: min(360px, 100%); }
    .totals-row { display: grid; grid-template-columns: 1fr 140px; border: 1px solid #111827; border-bottom: 0; }
    .totals-row:last-child { border-bottom: 1px solid #111827; }
    .totals-row div { padding: 8px 10px; }
    .totals-row div:last-child { text-align: right; border-left: 1px solid #111827; font-weight: 700; }
    .payment { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; align-items: flex-start; }
    .payment-note { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; line-height: 1.6; }
    .qr { width: 150px; border: 1px solid #d1d5db; border-radius: 8px; padding: 6px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 42px; text-align: center; }
    .signature-title { font-weight: 700; }
    .signature-note { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .signature-space { height: 72px; }
    @media print {
      .toolbar { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">In phiếu</button>
    <button class="primary" onclick="window.shareBill && window.shareBill()">Chia sẻ bill</button>
  </div>
  <div class="header">
    <div class="company">
      ${info.logoUrl ? `<img class="logo" src="${escapeHtml(info.logoUrl)}" alt="Logo" />` : ""}
      <div>
        <div class="company-name">${escapeHtml(info.name)}</div>
        <div>${escapeHtml(info.address)}</div>
        ${info.phone ? `<div>Điện thoại: ${escapeHtml(info.phone)}</div>` : ""}
        ${info.taxCode ? `<div>MST: ${escapeHtml(info.taxCode)}</div>` : ""}
      </div>
    </div>
    <div class="meta">
      <div><strong>Số phiếu:</strong> ${escapeHtml(order.id)}</div>
      <div><strong>Ngày:</strong> ${orderDate(order)}</div>
      <div><strong>Trạng thái:</strong> ${escapeHtml(order.status)}</div>
    </div>
  </div>

  <h1>PHIẾU XUẤT BÁN HÀNG</h1>
  <div class="date">Ngày ${orderDate(order)}</div>

  <div class="customer">
    <strong>Bên mua:</strong><div class="line">${escapeHtml(order.customerName)}</div>
    <strong>Địa chỉ:</strong><div class="line"></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 44px;">STT</th>
        <th>Tên vật tư</th>
        <th style="width: 74px;">ĐVT</th>
        <th style="width: 82px;">SL</th>
        <th style="width: 118px;">Đơn giá</th>
        <th style="width: 128px;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><div>Tổng cộng</div><div>${money(order.total)}</div></div>
    <div class="totals-row"><div>Đã trả</div><div>${money(order.paid)}</div></div>
    <div class="totals-row"><div>Còn nợ</div><div>${money(debt)}</div></div>
  </div>

  ${qrUrl ? `
  <div class="payment">
    <div class="payment-note">
      <strong>Thông tin thanh toán</strong><br />
      Chủ TK: ${escapeHtml(payment.accountName)}<br />
      Số TK: ${escapeHtml(payment.accountNumber)}<br />
      Nội dung: ${escapeHtml(content)}
    </div>
    <img class="qr" src="${escapeHtml(qrUrl)}" alt="QR thanh toán" />
  </div>` : ""}

  <div class="signatures">
    <div><div class="signature-title">Người lập phiếu</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
    <div><div class="signature-title">Người nhận hàng</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
    <div><div class="signature-title">Thủ kho</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
  </div>
</body>
</html>`;
}

export function printSalesOrder(order: Order, company?: CompanyInfo) {
  const popup = window.open("", "_blank", "width=920,height=720");
  if (!popup) {
    alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup để in phiếu.");
    return;
  }

  popup.document.open();
  popup.document.write("<!doctype html><meta charset='utf-8'><title>Đang tạo bill...</title><body style='font-family:Arial;padding:24px'>Đang tạo bill...</body>");
  popup.document.close();

  void (async () => {
    const [payment, loadedCompany] = await Promise.all([loadPaymentSettings(), loadCompanySettings()]);
    popup.document.open();
    popup.document.write(billHtml(order, { ...loadedCompany, ...company }, payment));
    popup.document.close();
    popup.focus();
    (popup as any).shareBill = async () => {
      const text = `Bill ${order.id} - ${order.customerName} - Tổng ${money(order.total)} - Còn nợ ${money(Math.max(0, order.total - order.paid))}`;
      if (popup.navigator?.share) {
        await popup.navigator.share({ title: `Bill ${order.id}`, text });
        return;
      }
      await popup.navigator?.clipboard?.writeText(text);
      popup.alert("Đã copy nội dung bill. Có thể dán vào Zalo/Messenger/Facebook.");
    };
    popup.setTimeout(() => popup.print(), 250);
  })();
}
