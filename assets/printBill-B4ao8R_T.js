import{g as v}from"./index-Bw8dWt08.js";const b={name:"PMQL",address:"",phone:"",logoUrl:"",taxCode:""};function c(i){return`${Math.round(i||0).toLocaleString("vi-VN")} đ`}function y(i){return Number(i||0).toLocaleString("vi-VN")}function r(i){return String(i??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function m(i){const a=String(i??"").trim();return/^https:\/\//i.test(a)||/^data:image\//i.test(a)?r(a):""}function u(i){const a=new Date(i.date);return Number.isNaN(a.getTime())?r(i.date):a.toLocaleDateString("vi-VN")}async function S(){try{return(await(await fetch("/api/settings?key=payment",{headers:await v()})).json()).payment??{}}catch{return{}}}async function w(){try{const e=(await(await fetch("/api/settings?key=branding")).json()).branding??{};return{name:e.companyName||e.appName,address:e.address,phone:e.hotline,logoUrl:e.logoUrl,taxCode:e.taxCode}}catch{return{}}}function T(i,a){return(i.transferTemplate||"Thanh toan {orderCode}").replaceAll("{orderCode}",a.id).replaceAll("{customerName}",a.customerName)}function N(i,a){if(!i.enabled||!i.bankBin||!i.accountNumber)return"";const e=Math.max(0,Math.round(a.total-a.paid));if(e<=0)return"";const l=new URLSearchParams({amount:String(e),addInfo:T(i,a),accountName:i.accountName??""});return`https://img.vietqr.io/image/${encodeURIComponent(i.bankBin)}-${encodeURIComponent(i.accountNumber)}-compact2.png?${l.toString()}`}function A(i,a={},e={}){const l={...b,...a},o=i.items.reduce((d,h)=>d+h.total,0),t=Math.max(0,o-i.total),n=Math.max(0,i.total-i.paid),s=N(e,i),p=T(e,i),g=i.items.map((d,h)=>`
    <tr>
      <td class="center">${h+1}</td>
      <td>
        <strong>${r(d.name)}</strong>
        ${d.size?`<div class="muted">${r(d.size)}</div>`:""}
      </td>
      <td class="center">${r(d.unit)}</td>
      <td class="right">${y(d.quantity)}</td>
      <td class="right">${c(d.price)}</td>
      <td class="right">${c(d.total)}</td>
    </tr>
  `).join("");return`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Phiếu xuất bán hàng ${r(i.id)}</title>
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
      ${m(l.logoUrl)?`<img class="logo" src="${m(l.logoUrl)}" alt="Logo" />`:""}
      <div>
        <div class="company-name">${r(l.name)}</div>
        <div>${r(l.address)}</div>
        ${l.phone?`<div>Điện thoại: ${r(l.phone)}</div>`:""}
        ${l.taxCode?`<div>MST: ${r(l.taxCode)}</div>`:""}
      </div>
    </div>
    <div class="meta">
      <div><strong>Số phiếu:</strong> ${r(i.id)}</div>
      <div><strong>Ngày:</strong> ${u(i)}</div>
    </div>
  </div>

  <h1>PHIẾU XUẤT BÁN HÀNG</h1>
  <div class="date">Ngày ${u(i)}</div>

  <div class="customer">
    <strong>Bên mua:</strong><div class="line">${r(i.customerName)}</div>
    <strong>Địa chỉ:</strong><div class="line">-</div>
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
    <tbody>${g}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><div>Tạm tính</div><div>${c(o)}</div></div>
    <div class="totals-row"><div>Chiết khấu</div><div>${c(t)}</div></div>
    <div class="totals-row"><div>Tổng cộng</div><div>${c(i.total)}</div></div>
    <div class="totals-row"><div>Đã trả</div><div>${c(i.paid)}</div></div>
    <div class="totals-row"><div>Còn phải thu</div><div>${c(n)}</div></div>
  </div>

  ${s?`
  <div class="payment">
    <div class="payment-note">
      <strong>Thông tin thanh toán</strong><br />
      Chủ TK: ${r(e.accountName)}<br />
      Số TK: ${r(e.accountNumber)}<br />
      Nội dung: ${r(p)}
    </div>
    <img class="qr" src="${r(s)}" alt="QR thanh toán" />
  </div>`:""}

  <div class="signatures">
    <div><div class="signature-title">Người lập phiếu</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
    <div><div class="signature-title">Người nhận hàng</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
    <div><div class="signature-title">Thủ kho</div><div class="signature-note">(Ký, ghi rõ họ tên)</div><div class="signature-space"></div></div>
  </div>
</body>
</html>`}function B(i,a){const e=window.open("","_blank","width=920,height=720");if(!e){alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup để in phiếu.");return}e.document.open(),e.document.write("<!doctype html><meta charset='utf-8'><title>Đang tạo bill...</title><body style='font-family:Arial;padding:24px'>Đang tạo bill...</body>"),e.document.close(),(async()=>{const[l,o]=await Promise.all([S(),w()]);e.document.open(),e.document.write(A(i,{...o,...a},l)),e.document.close(),e.focus(),e.shareBill=async()=>{var n,s,p;const t=`Bill ${i.id} - ${i.customerName} - Tổng ${c(i.total)} - Còn nợ ${c(Math.max(0,i.total-i.paid))}`;if((n=e.navigator)!=null&&n.share){await e.navigator.share({title:`Bill ${i.id}`,text:t});return}await((p=(s=e.navigator)==null?void 0:s.clipboard)==null?void 0:p.writeText(t)),e.alert("Đã copy nội dung bill. Có thể dán vào Zalo/Messenger/Facebook.")},e.setTimeout(()=>e.print(),250)})()}async function L(i){const a=await fetch(`/api/export/bill-xlsx?order=${encodeURIComponent(i.id)}`,{headers:await v()});if(!a.ok){const t=await a.json().catch(()=>null);throw new Error((t==null?void 0:t.error)??"Không xuất được file XLSX.")}const e=await a.blob(),l=URL.createObjectURL(e),o=document.createElement("a");o.href=l,o.download=`phieu-xuat-${i.id}.xlsx`,document.body.appendChild(o),o.click(),o.remove(),URL.revokeObjectURL(l)}function C(i,a,e,l,o,t){const n=a.split(" ");let s="",p=l;for(const g of n){const d=s?`${s} ${g}`:g;i.measureText(d).width>o&&s?(i.fillText(s,e,p),s=g,p+=t):s=d}return s&&i.fillText(s,e,p),p+t}function k(i){return new Promise((a,e)=>{i.toBlob(l=>l?a(l):e(new Error("Không tạo được ảnh bill.")),"image/png",.95)})}async function R(i){const a={...b,...await w()},e=i.items.reduce((f,x)=>f+x.total,0),l=Math.max(0,e-i.total),o=document.createElement("canvas");o.width=1080,o.height=Math.max(1500,780+i.items.length*86);const t=o.getContext("2d");if(!t)throw new Error("Trình duyệt không hỗ trợ tạo ảnh bill.");t.fillStyle="#ffffff",t.fillRect(0,0,o.width,o.height),t.fillStyle="#111827",t.font="700 34px Arial",t.fillText(a.name,56,70),t.font="400 24px Arial",a.address&&t.fillText(a.address,56,108),t.textAlign="right",t.font="700 28px Arial",t.fillText(`Số phiếu: ${i.id}`,1024,72),t.font="400 22px Arial",t.fillText(`Ngày: ${u(i)}`,1024,108),t.textAlign="left",t.font="800 44px Arial",t.textAlign="center",t.fillText("PHIẾU XUẤT BÁN HÀNG",540,190),t.textAlign="left",t.font="700 26px Arial",t.fillText("Bên mua:",56,250),t.font="400 26px Arial",t.fillText(i.customerName,176,250);let n=320;t.fillStyle="#f3f4f6",t.fillRect(56,n-42,968,54),t.fillStyle="#111827",t.font="700 22px Arial",t.fillText("STT",76,n-8),t.fillText("Tên hàng",148,n-8),t.fillText("ĐVT",650,n-8),t.fillText("SL",740,n-8),t.fillText("Thành tiền",850,n-8),n+=32,t.font="400 22px Arial",i.items.forEach((f,x)=>{t.fillStyle=x%2===0?"#ffffff":"#f9fafb",t.fillRect(56,n-30,968,76),t.fillStyle="#111827",t.fillText(String(x+1),82,n);const $=C(t,f.name,148,n,470,26);t.fillText(f.unit,650,n),t.fillText(y(f.quantity),740,n),t.font="700 22px Arial",t.fillText(c(f.total),850,n),t.font="400 22px Arial",n=Math.max(n+76,$+18)}),n+=28,t.font="700 28px Arial",t.textAlign="right",t.fillText(`Tạm tính: ${c(e)}`,1024,n),n+=42,t.fillText(`Chiết khấu: ${c(l)}`,1024,n),n+=42,t.fillText(`Tổng cộng: ${c(i.total)}`,1024,n),n+=42,t.fillStyle="#047857",t.fillText(`Đã thu: ${c(i.paid)}`,1024,n),n+=42,t.fillStyle="#dc2626",t.fillText(`Còn phải thu: ${c(Math.max(0,i.total-i.paid))}`,1024,n),t.fillStyle="#111827",t.textAlign="left",n+=120,t.font="700 24px Arial",t.textAlign="center",t.fillText("Kế toán/Bên giao",210,n),t.fillText("Người giao hàng",540,n),t.fillText("Bên nhận hàng",870,n),n+=34,t.font="400 20px Arial",t.fillText("(Ký, ghi rõ họ tên)",210,n),t.fillText("(Ký, ghi rõ họ tên)",540,n),t.fillText("(Ký, ghi rõ họ tên)",870,n);const s=await k(o),p=new File([s],`bill-${i.id}.png`,{type:"image/png"}),g=navigator;if(navigator.share&&(!g.canShare||g.canShare({files:[p]}))){await navigator.share({title:`Bill ${i.id}`,text:`Bill ${i.id}`,files:[p]});return}const d=URL.createObjectURL(s),h=document.createElement("a");h.href=d,h.download=`bill-${i.id}.png`,h.click(),URL.revokeObjectURL(d)}export{L as e,B as p,R as s};
