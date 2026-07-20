import React, { useState, useEffect, useMemo } from "react";
import { ChevronUp, Search } from "lucide-react";
import "./Guide.css";

const tocItems = [
  { id: "s1", num: "1", title: "Đăng nhập & vào phần mềm" },
  { id: "s2", num: "2", title: "Giao diện & điều hướng" },
  { id: "s3", num: "3", title: "Vai trò & phân quyền" },
  { id: "s4", num: "4", title: "Tổng quan (Dashboard)" },
  { id: "s5", num: "5", title: "Bán hàng tại quầy (POS)" },
  { id: "s6", num: "6", title: "Đơn hàng & Trả hàng" },
  { id: "s7", num: "7", title: "Khách hàng & số dư" },
  { id: "s8", num: "8", title: "Sản phẩm & bảng giá" },
  { id: "s9", num: "9", title: "Tồn kho" },
  { id: "s10", num: "10", title: "Nhà cung cấp" },
  { id: "s11", num: "11", title: "Tài chính & công nợ" },
  { id: "s12", num: "12", title: "Chi phí & báo cáo" },
  { id: "s13", num: "13", title: "Cấu hình & Vận hành" },
  { id: "s14", num: "14", title: "Quy trình mẫu" },
  { id: "s15", num: "15", title: "Dành cho quản trị" }
];

export function Guide() {
  const [showTop, setShowTop] = useState(false);
  const [activeId, setActiveId] = useState("s1");
  const [search, setSearch] = useState("");
  
  useEffect(() => {
    const handleScroll = () => {
      setShowTop(window.scrollY > 400);
      
      // Update active TOC item based on scroll position
      const sections = document.querySelectorAll(".guide-page section[id]");
      let current = "s1";
      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (window.scrollY >= sectionTop - 60) {
          current = section.getAttribute("id") || "s1";
        }
      });
      setActiveId(current);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredToc = useMemo(() => {
    if (!search) return tocItems;
    const lowerSearch = search.toLowerCase();
    return tocItems.filter(item => item.title.toLowerCase().includes(lowerSearch));
  }, [search]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="guide-page">
      <header className="mast">
        <div className="mast-in">
          <div className="brandrow">
            <div className="logo">B</div>
            <div><b>Phần mềm Quản lý Bán hàng</b><span>Cẩm nang vận hành cho cửa hàng</span></div>
          </div>
          <p className="eyebrow">Hướng dẫn sử dụng · v2.1</p>
          <h1>Bán hàng, kho, công nợ và trả hàng — trong một nơi</h1>
          <p className="lede">
            Tài liệu này đưa bạn qua từng màn hình của phần mềm: từ đăng nhập, bán hàng tại quầy (POS), quản lý đơn — kho — khách hàng, cho tới các nghiệp vụ tài chính mới nhất: <b>số dư khách hàng</b> và <b>trả hàng / hoàn tiền</b>.
          </p>
          <div className="mast-meta">
            <span>Đối tượng: <b>chủ cửa hàng, kế toán, nhân viên bán hàng &amp; kho</b></span>
            <span>Truy cập: <b>trình duyệt hoặc cài như app (PWA)</b></span>
            <span>Ngôn ngữ giao diện: <b>Tiếng Việt</b></span>
          </div>
        </div>
      </header>

      <div className="shell">
        <div className="layout">
          {/* ================= TOC ================= */}
          <aside className="toc">
            <details className="toc-card" id="toc" open>
              <summary>Mục lục <span className="chev">▾</span></summary>
              <div className="toc-title">Nội dung</div>
              <div className="px-3 pb-2 pt-1">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-[var(--ink-faint)]" />
                  <input 
                    type="text" 
                    placeholder="Tìm nhanh..." 
                    className="search-input !pl-8" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <nav id="tocnav">
                {filteredToc.length > 0 ? (
                  filteredToc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={activeId === item.id ? "active" : ""}
                    >
                      <span className="n">{item.num}</span> {item.title}
                    </a>
                  ))
                ) : (
                  <div className="text-center text-xs text-[var(--ink-faint)] py-2">Không tìm thấy nội dung.</div>
                )}
              </nav>
            </details>
          </aside>

          {/* ================= MAIN ================= */}
          <main>
            {/* 1 */}
            <section className="sec" id="s1" style={{ display: search && !filteredToc.find(t => t.id === "s1") ? "none" : "block" }}>
              <div className="hd"><span className="num">01</span><h2>Đăng nhập &amp; vào phần mềm</h2></div>
              <p className="sub">Mỗi người dùng có một tài khoản riêng do quản trị viên (admin) tạo. Tài khoản quyết định bạn nhìn thấy và làm được gì.</p>
              <ol className="steps">
                <li>Mở phần mềm trên trình duyệt (hoặc mở biểu tượng app nếu đã cài).</li>
                <li>Đăng nhập bằng <b>Email &amp; mật khẩu</b>, hoặc bấm <span className="kbd">Đăng nhập bằng Google</span>.</li>
                <li>Nếu báo lỗi không vào được: email của bạn <b>chưa được admin thêm và kích hoạt</b>. Báo admin thêm tài khoản ở mục Cấu hình → Người dùng.</li>
              </ol>
              <div className="call">
                <p className="ct"><span className="ic">💡</span> Cài như một ứng dụng (PWA)</p>
                <p>Trên điện thoại/máy tính, trình duyệt sẽ gợi ý “Thêm vào màn hình chính / Cài đặt”. Cài xong bạn mở nhanh như app thường, dùng được cả khi mạng chập chờn.</p>
              </div>
            </section>

            {/* 2 */}
            <section className="sec" id="s2" style={{ display: search && !filteredToc.find(t => t.id === "s2") ? "none" : "block" }}>
              <div className="hd"><span className="num">02</span><h2>Giao diện &amp; điều hướng</h2></div>
              <p className="sub">Menu bên trái chia làm 3 nhóm. Bạn chỉ thấy các mục mình có quyền — nếu thiếu mục nào so với tài liệu này, đó là do phân quyền.</p>
              <figure className="mock">
                <div className="mbar"><span className="dots"><i></i><i></i><i></i></span><span className="murl">app · Tổng quan</span></div>
                <div className="mbody">
                  <div className="app-shell">
                    <div className="app-nav hidden lg:block">
                      <div className="grp">Vận hành</div>
                      <div className="it on"><span className="sq"></span>Tổng quan</div>
                      <div className="it"><span className="sq"></span>Bán hàng POS</div>
                      <div className="it"><span className="sq"></span>Đơn hàng</div>
                      <div className="it"><span className="sq"></span>Sản phẩm</div>
                      <div className="it"><span className="sq"></span>Tồn kho</div>
                      <div className="grp">Đối tác</div>
                      <div className="it"><span className="sq"></span>Khách hàng</div>
                      <div className="it"><span className="sq"></span>Nhà cung cấp</div>
                      <div className="grp">Tài chính</div>
                      <div className="it"><span className="sq"></span>Báo cáo tài chính</div>
                      <div className="it"><span className="sq"></span>Cấu hình</div>
                    </div>
                    <div className="app-main">
                      <div className="m-topbar"><span className="m-h">Trung tâm điều hành</span><span className="pill">🔔 Thông báo</span></div>
                      <div className="m-cards">
                        <div className="m-card"><div className="l">Doanh thu</div><div className="v g">42.500.000 ₫</div></div>
                        <div className="m-card"><div className="l">Phải thu</div><div className="v r">8.200.000 ₫</div></div>
                        <div className="m-card"><div className="l">Quỹ tiền mặt</div><div className="v">15.900.000 ₫</div></div>
                      </div>
                      <div className="m-row"><span>Cảnh báo tồn kho thấp</span><span className="pill">3 mặt hàng</span></div>
                      <div className="m-row"><span>Khách cần nhắc nợ</span><span className="pill">5 khách</span></div>
                    </div>
                  </div>
                </div>
                <figcaption><b>Mô phỏng:</b> bố cục chung — menu trái, thanh trên có chuông thông báo, nội dung ở giữa.</figcaption>
              </figure>
              <ul className="plain">
                <li><b>Chuông thông báo</b> (góc trên): nhắc công nợ đến hạn, việc cần xử lý.</li>
                <li>Trên điện thoại, menu thu lại; bấm biểu tượng ☰ để mở, hoặc dùng thanh phím tắt dưới đáy màn hình.</li>
                <li>Đổi <b>giao diện/màu nền</b> (sáng/tối/theo chủ đề) tại <span className="path"><b>Cấu hình → Giao diện</b></span>.</li>
              </ul>
            </section>

            {/* 3 */}
            <section className="sec" id="s3" style={{ display: search && !filteredToc.find(t => t.id === "s3") ? "none" : "block" }}>
              <div className="hd"><span className="num">03</span><h2>Vai trò &amp; phân quyền</h2></div>
              <p className="sub">Có 5 vai trò mặc định. Admin có thể tinh chỉnh từng quyền cho mỗi nhân viên trong <span className="path"><b>Cấu hình → Người dùng</b></span>.</p>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Vai trò</th><th>Làm được gì</th><th>Điển hình</th></tr></thead>
                  <tbody>
                    <tr><td><span className="rl-tag rl-admin">ADMIN</span></td><td>Toàn quyền: cấu hình, người dùng, vận hành, xóa dữ liệu, mọi nghiệp vụ.</td><td>Chủ cửa hàng</td></tr>
                    <tr><td><span className="rl-tag rl-acc">ACCOUNTANT</span></td><td>Bán hàng, đơn, khách, xem kho, <b>toàn bộ tài chính</b>: phiếu thu, quỹ, hủy đơn, <b>trả hàng</b>.</td><td>Kế toán</td></tr>
                    <tr><td><span className="rl-tag rl-sale">SALE</span></td><td>Bán hàng &amp; xem đơn/khách <b>của mình</b>; xem sản phẩm, tồn kho.</td><td>Nhân viên bán hàng</td></tr>
                    <tr><td><span className="rl-tag rl-wh">WAREHOUSE</span></td><td>Quản lý sản phẩm, nhập/xuất/kiểm kho, duyệt kiểm kê.</td><td>Thủ kho</td></tr>
                    <tr><td><span className="rl-tag rl-view">VIEWER</span></td><td>Chỉ xem trang Tổng quan.</td><td>Người theo dõi</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="call new">
                <p className="ct"><span className="ic">✨</span> Quyền mới: “Trả hàng / hoàn tiền”</p>
                <p>Nghiệp vụ trả hàng dùng quyền riêng <span className="kbd">orders.return</span>. Mặc định bật cho <b>ADMIN</b> và <b>ACCOUNTANT</b>. Muốn cho nhân viên khác trả hàng, admin bật quyền này cho họ ở nhóm quyền “Bán hàng &amp; đơn hàng”.</p>
              </div>
            </section>

            {/* 4 */}
            <section className="sec" id="s4" style={{ display: search && !filteredToc.find(t => t.id === "s4") ? "none" : "block" }}>
              <div className="hd"><span className="num">04</span><h2>Tổng quan (Dashboard)</h2></div>
              <p className="sub">Trang đầu tiên sau khi đăng nhập — bức tranh nhanh về sức khỏe cửa hàng theo kỳ bạn chọn.</p>
              <ul className="plain">
                <li><b>Thẻ số liệu:</b> Doanh thu, Lợi nhuận ước tính, tồn kho (ổn định / sắp hết / hết hàng), công nợ phải thu, hẹn thu quá hạn.</li>
                <li><b>Biểu đồ Doanh thu &amp; Thực thu</b> theo ngày; bấm vào thẻ để mở báo cáo chi tiết ở trang Chi phí.</li>
                <li>Chọn kỳ xem (hôm nay / tháng / 30 ngày / tùy chọn) ở thanh trên.</li>
              </ul>
              <div className="call"><p className="ct"><span className="ic">👁️</span> Lưu ý</p><p>Ô “Lợi nhuận ước tính” chỉ hiện với người có quyền xem sổ quỹ; người khác thấy dấu “—”.</p></div>
            </section>

            {/* 5 */}
            <section className="sec" id="s5" style={{ display: search && !filteredToc.find(t => t.id === "s5") ? "none" : "block" }}>
              <div className="hd"><span className="num">05</span><h2>Bán hàng tại quầy (POS)</h2></div>
              <p className="sub">Màn hình bán hàng: chọn sản phẩm vào giỏ, chọn khách, nhận tiền và xuất bill. Đây cũng là nơi <b>dùng số dư của khách quen</b> để trả cho đơn.</p>
              <h3><span className="tick"></span>Các bước bán một đơn</h3>
              <ol className="steps">
                <li>Tìm và bấm sản phẩm để thêm vào <b>giỏ hàng</b>; chỉnh số lượng nếu cần.</li>
                <li>Chọn <b>khách hàng</b> (hoặc để “Khách lẻ”). Có thể tạo nhanh khách mới ngay tại đây.</li>
                <li>Nhập <b>Chiết khấu (%)</b> nếu được phép (cần quyền sửa giá).</li>
                <li>Chọn <b>Tiền mặt</b> hoặc <b>Chuyển khoản</b>. Chọn chuyển khoản sẽ hiện <b>mã QR VietQR</b> để khách quét.</li>
                <li>Nhập <b>Khách đưa</b> → phần mềm tính <b>Tiền thừa</b>. Thu thiếu sẽ ghi thành công nợ (bắt buộc đã chọn khách).</li>
                <li>Bấm <span className="kbd">Hoàn tất thanh toán</span> → phần mềm trừ kho, ghi sổ và mở <b>bill</b> để in / chia sẻ ảnh.</li>
              </ol>
              <figure className="mock">
                <div className="mbar"><span className="dots"><i></i><i></i><i></i></span><span className="murl">app · Bán hàng (POS) — thanh toán</span></div>
                <div className="mbody">
                  <div className="m-panel" style={{ marginBottom: 10 }}>
                    <span className="m-lab">Khách hàng</span>
                    <div className="m-row" style={{ borderColor: "color-mix(in srgb,var(--emerald) 30%,transparent)" }}>
                      <div><b>Cô Lan — Tạp hóa số 7</b><div style={{ color: "var(--ink-faint)" }}>Nợ cũ: <span className="r">1.200.000đ</span> · Số dư: <span className="g">500.000đ</span></div></div>
                      <span className="m-btn out">✕</span>
                    </div>
                  </div>
                  <div className="m-line"><span>Tổng tiền hàng</span><span className="m-money">2.000.000 ₫</span></div>
                  <div className="m-line tot"><span>Khách cần trả</span><span className="m-money g">2.000.000 ₫</span></div>
                  <div className="m-credit" style={{ margin: "10px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ color: "var(--emerald-ink)" }}>Dùng số dư (500.000 đ)</b>
                      <span className="m-btn pri" style={{ padding: "4px 9px" }}>Dùng tối đa</span>
                    </div>
                    <div className="m-line" style={{ color: "var(--emerald-ink)", marginTop: 6 }}><span>Trừ số dư: −500.000 đ</span><span>Còn thu: 1.500.000 đ</span></div>
                  </div>
                  <div className="m-seg" style={{ marginBottom: 10 }}><span className="s on">Tiền mặt</span><span className="s">Chuyển khoản</span></div>
                  <span className="m-btn pri" style={{ display: "block", textAlign: "center", padding: 11 }}>Hoàn tất thanh toán</span>
                </div>
                <figcaption><b>Mô phỏng:</b> panel thanh toán với khối <b>Dùng số dư</b> — nhân viên chủ động nhập số tiền lấy từ số dư của khách.</figcaption>
              </figure>
              <div className="call new">
                <p className="ct"><span className="ic">✨</span> Dùng số dư khách hàng</p>
                <p>Khi khách quen có <b>số dư</b> (tiền gửi trước / trả thừa), khối xanh “Dùng số dư” hiện ra. Nhập số tiền muốn trừ (hoặc bấm <span className="kbd">Dùng tối đa</span>) — phần còn lại mới thu tiền mặt/chuyển khoản. Phần mềm <b>không tự trừ</b>, bạn chủ động quyết định từng đơn.</p>
              </div>
              <div className="call"><p className="ct"><span className="ic">💾</span> Lưu nháp</p><p>Đang bán mà bận việc? Bấm <b>Lưu nháp</b> để giữ giỏ hàng trên thiết bị này và bán tiếp sau.</p></div>
            </section>

            {/* 6 */}
            <section className="sec" id="s6" style={{ display: search && !filteredToc.find(t => t.id === "s6") ? "none" : "block" }}>
              <div className="hd"><span className="num">06</span><h2>Đơn hàng &amp; Trả hàng <span className="pill new">Mới</span></h2></div>
              <p className="sub">Xem lại toàn bộ đơn đã bán (trang Đơn hàng cũng là nhật ký đơn). Mở một đơn để in lại, hủy, hoặc <b>trả hàng — hoàn tiền — hoàn nhập kho</b>.</p>
              <h3><span className="tick"></span>Xem &amp; thao tác trên đơn</h3>
              <ul className="plain">
                <li>Lọc theo <b>ngày, khách hàng, loại hàng, tình trạng nợ</b>; tìm theo mã đơn.</li>
                <li>Mở một đơn để: <b>Xuất XLSX</b>, <b>Mở bill</b>, <b>In hóa đơn</b>, <b>Chia sẻ ảnh bill</b>.</li>
                <li><b>Hủy đơn</b> <span className="pill">ADMIN/Kế toán</span>: hoàn lại kho &amp; đảo sổ toàn bộ đơn (dùng khi ghi nhầm cả đơn).</li>
                <li><b>Trả hàng</b> <span className="pill new">quyền Trả hàng</span>: trả <b>một phần</b> hoặc toàn bộ, có hoàn tiền.</li>
              </ul>
              <p>Trạng thái đơn hiển thị bằng màu: <span className="pill" style={{ background: "var(--emerald-bg)", color: "var(--emerald-ink)" }}>Đã thanh toán</span> <span className="pill" style={{ background: "var(--red-bg)", color: "var(--red)" }}>Nợ</span> <span className="pill" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>Trả một phần / Đã trả hàng</span> <span className="pill">Đã hủy</span>.</p>
              <h3><span className="tick"></span>Lập phiếu trả hàng</h3>
              <ol className="steps">
                <li>Mở đơn cần trả → bấm <span className="kbd">Trả hàng</span>.</li>
                <li>Với mỗi dòng hàng, nhập <b>số lượng trả</b> và chọn tình trạng:
                  <b>Hàng tốt → về kho chính</b> (bán lại được) hoặc <b>Hàng lỗi → kho lỗi</b> (KHO-LOI, theo dõi riêng).</li>
                <li>Chọn <b>lý do</b>: Hàng lỗi / Trả hàng dư / Giao nhầm / Khác.</li>
                <li>Chọn <b>phương thức hoàn</b> phần tiền vượt nợ: Tiền mặt · Chuyển khoản · <b>Cộng số dư</b> · Cấn công nợ khác.</li>
                <li>Xem lại tổng tiền hàng trả → bấm <span className="kbd">Xác nhận trả hàng</span>.</li>
              </ol>
              <figure className="mock">
                <div className="mbar"><span className="dots"><i></i><i></i><i></i></span><span className="murl">app · Trả hàng đơn HD240720-001</span></div>
                <div className="mbody">
                  <div className="m-row"><div>Gạch men 60×60<div style={{ color: "var(--ink-faint)" }}>Đã mua: 10 hộp × 200.000đ</div></div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="m-input" style={{ flex: "none", width: 52, textAlign: "right", color: "var(--ink)" }}>2</span><span className="m-select" style={{ minWidth: 120 }}><span>Hàng tốt → kho chính</span></span></div></div>
                  <div className="m-row"><div>Keo dán gạch<div style={{ color: "var(--ink-faint)" }}>Đã mua: 5 bao × 90.000đ</div></div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="m-input" style={{ flex: "none", width: 52, textAlign: "right", color: "var(--ink)" }}>1</span><span className="m-select" style={{ minWidth: 120, borderColor: "color-mix(in srgb,var(--amber) 40%,transparent)" }}><span className="a">Hàng lỗi → kho lỗi</span></span></div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                    <div><span className="m-lab">Lý do</span><div className="m-select"><span>Hàng lỗi</span><span className="cv">▾</span></div></div>
                    <div><span className="m-lab">Hoàn tiền</span><div className="m-select"><span>Cộng số dư</span><span className="cv">▾</span></div></div>
                  </div>
                  <div className="m-panel" style={{ marginTop: 12 }}><div className="m-line tot" style={{ border: "none", margin: 0, padding: 0 }}><span>Tổng tiền hàng trả</span><span className="g m-money">490.000 ₫</span></div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                    <span className="m-btn out" style={{ textAlign: "center", justifyContent: "center" }}>Đóng</span>
                    <span className="m-btn amber" style={{ textAlign: "center", justifyContent: "center" }}>Xác nhận trả hàng</span>
                  </div>
                </div>
                <figcaption><b>Mô phỏng:</b> hộp thoại trả hàng — chọn số lượng &amp; tình trạng từng dòng, lý do, phương thức hoàn.</figcaption>
              </figure>
              <div className="call new">
                <p className="ct"><span className="ic">✨</span> Tiền hoàn được xử lý thông minh</p>
                <p>Phần mềm <b>tự cấn vào phần nợ còn lại của chính đơn đó trước</b>. Chỉ phần vượt nợ mới hoàn theo cách bạn chọn. Chọn <b>“Cấn công nợ khác”</b> mà khách hết nợ thì phần dư tự chuyển vào <b>số dư</b> của khách. Mọi thứ ghi đồng bộ sang tồn kho, sổ quỹ và công nợ.</p>
              </div>
            </section>

            {/* 7 */}
            <section className="sec" id="s7" style={{ display: search && !filteredToc.find(t => t.id === "s7") ? "none" : "block" }}>
              <div className="hd"><span className="num">07</span><h2>Khách hàng &amp; số dư <span className="pill new">Mới</span></h2></div>
              <p className="sub">Danh bạ khách hàng kèm công nợ, hạn mức và <b>số dư (tiền khách gửi/trả thừa)</b>. Mở một khách để xem sổ công nợ và lịch sử mua.</p>
              <ul className="plain">
                <li>Cột <b>Nợ hiện tại</b> (đỏ) và, nếu có, dòng <b>Dư</b> (xanh) — tiền khách đang gửi tại cửa hàng.</li>
                <li>Thẻ chi tiết khách: Công nợ, Số dư/Hạn mức, Doanh số, Đã thu; các tab <b>Tổng quan · Sổ công nợ · Lịch sử mua · Ghi chú</b>.</li>
                <li>Tạo/sửa khách kèm SĐT, địa chỉ, nhóm khách và <b>hạn mức nợ</b>.</li>
              </ul>
              <div className="call"><p className="ct"><span className="ic">🔎</span> Số dư đến từ đâu?</p><p>Số dư tăng khi khách <b>trả tiền vượt số nợ</b> (ở phiếu thu) hoặc khi <b>hoàn tiền trả hàng vào số dư</b>. Số dư giảm khi <b>dùng ở POS</b> hoặc <b>rút trả khách</b> (ở trang Tài chính).</p></div>
            </section>

            {/* 8 */}
            <section className="sec" id="s8" style={{ display: search && !filteredToc.find(t => t.id === "s8") ? "none" : "block" }}>
              <div className="hd"><span className="num">08</span><h2>Sản phẩm &amp; bảng giá</h2></div>
              <p className="sub">Danh mục hàng hóa: mã, tên, đơn vị tính, quy đổi (m²/hộp, viên/hộp), giá bán, giá vốn và tồn.</p>
              <ul className="plain">
                <li>Với mỗi mặt hàng: <b>Đưa vào bán hàng</b> (mở POS), <b>Sửa</b>, hoặc <b>Ngưng bán</b>.</li>
                <li>Lọc theo loại hàng và tình trạng tồn (còn hàng / sắp hết / hết hàng).</li>
                <li><b>Bảng giá bán:</b> chỉnh giá hàng loạt, <b>xuất/nhập XLSX</b>. Nếu bạn không có quyền duyệt giá, thay đổi sẽ được <b>gửi chờ admin duyệt</b>.</li>
              </ul>
            </section>

            {/* 9 */}
            <section className="sec" id="s9" style={{ display: search && !filteredToc.find(t => t.id === "s9") ? "none" : "block" }}>
              <div className="hd"><span className="num">09</span><h2>Tồn kho</h2></div>
              <p className="sub">Theo dõi tồn và ghi các phiếu <b>Nhập kho · Xuất kho · Kiểm kho</b>. Xem biến động kho gần đây.</p>
              <ul className="plain">
                <li><b>Nhập kho:</b> chọn/khai báo sản phẩm, số lượng, giá vốn, nhà cung cấp, chứng từ. Có thể <b>tạo sản phẩm mới ngay khi nhập</b>.</li>
                <li><b>Xuất kho:</b> ghi xuất theo loại nghiệp vụ (không phải bán hàng).</li>
                <li><b>Kiểm kho:</b> nhập <b>tồn thực tế</b>; hệ thống tính chênh lệch. Người không có quyền áp dụng sẽ <b>gửi chờ duyệt</b>.</li>
              </ul>
              <div className="call new"><p className="ct"><span className="ic">✨</span> Kho hàng lỗi (KHO-LOI)</p><p>Khi trả hàng có dòng “Hàng lỗi”, phần mềm tự tạo kho <b>KHO-LOI</b> và nhập vào đó — tách khỏi tồn bán được để bạn theo dõi và xử lý riêng.</p></div>
            </section>

            {/* 10 */}
            <section className="sec" id="s10" style={{ display: search && !filteredToc.find(t => t.id === "s10") ? "none" : "block" }}>
              <div className="hd"><span className="num">10</span><h2>Nhà cung cấp</h2></div>
              <p className="sub">Quản lý nhà cung cấp (NCC), công nợ phải trả và thông tin dùng khi nhập kho.</p>
              <ul className="plain">
                <li>Danh sách NCC kèm <b>công nợ phải trả</b>; xuất/nhập XLSX.</li>
                <li>Bấm một NCC để <b>Thanh toán công nợ nhà cung cấp</b> — ghi chi tiền và giảm nợ phải trả, đồng bộ sổ quỹ.</li>
              </ul>
            </section>

            {/* 11 */}
            <section className="sec" id="s11" style={{ display: search && !filteredToc.find(t => t.id === "s11") ? "none" : "block" }}>
              <div className="hd"><span className="num">11</span><h2>Tài chính &amp; công nợ <span className="pill new">Mới</span></h2></div>
              <p className="sub">Trung tâm tiền bạc: thu nợ, quỹ tiền mặt/ngân hàng, nhắc nợ, và giờ có thêm <b>phiếu trả hàng</b> &amp; <b>rút số dư khách</b>.</p>
              <figure className="mock">
                <div className="mbar"><span className="dots"><i></i><i></i><i></i></span><span className="murl">app · Báo cáo tài chính</span></div>
                <div className="mbody">
                  <div className="m-cards" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                    <div className="m-card"><div className="l">Đã thu kỳ</div><div className="v g">28.400.000 ₫</div></div>
                    <div className="m-card"><div className="l">Phải thu</div><div className="v r">8.200.000 ₫</div><div className="l g" style={{ marginTop: 2, textTransform: "none", letterSpacing: 0 }}>Khách gửi dư: 500.000 ₫</div></div>
                    <div className="m-card"><div className="l">Quỹ tiền mặt</div><div className="v">15.900.000 ₫</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                    <span className="m-btn out">Chuyển quỹ</span><span className="m-btn out">Rút quỹ</span>
                    <span className="m-btn out">Rút số dư khách</span><span className="m-btn pri">＋ Lập phiếu thu</span>
                  </div>
                  <div className="m-panel">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><b>Phiếu trả hàng</b><span className="pill">2</span></div>
                    <div className="m-row"><div><b className="a">TH240720-01</b><div style={{ color: "var(--ink-faint)" }}>Cô Lan · Hàng lỗi · Cộng số dư</div></div><span className="a m-money">−490.000 ₫</span></div>
                  </div>
                </div>
                <figcaption><b>Mô phỏng:</b> trang Tài chính — thẻ “Phải thu” kèm “Khách gửi dư”, nút “Rút số dư khách”, và khối “Phiếu trả hàng”.</figcaption>
              </figure>
              <h3><span className="tick"></span>Lập phiếu thu (thu nợ)</h3>
              <ol className="steps">
                <li>Bấm <span className="kbd">Lập phiếu thu</span> → chọn khách hàng.</li>
                <li>Nhập số tiền thu; có thể <b>phân bổ vào từng đơn nợ</b> hoặc để hệ thống tự thu đơn đến hạn trước.</li>
                <li>Chọn Tiền mặt / Chuyển khoản → xác nhận. Sổ quỹ và công nợ tự cập nhật.</li>
              </ol>
              <div className="call new"><p className="ct"><span className="ic">✨</span> Thu vượt nợ → cộng số dư</p><p>Giờ bạn được phép <b>thu nhiều hơn số nợ</b> của khách. Phần vượt tự động <b>cộng vào số dư</b> của khách để dùng cho đơn sau — tiện cho khách quen gửi tiền trước.</p></div>
              <h3><span className="tick"></span>Rút số dư trả khách</h3>
              <p>Khi khách muốn lấy lại tiền đang gửi: bấm <span className="kbd">Rút số dư khách</span> <span className="pill">Kế toán/Admin</span>, chọn khách, nhập số tiền và cách chi (tiền mặt/chuyển khoản). Sổ quỹ ghi một khoản chi và số dư khách giảm tương ứng.</p>
              <h3><span className="tick"></span>Quỹ &amp; nhắc nợ</h3>
              <ul className="plain">
                <li><b>Chuyển quỹ</b> (tiền mặt ↔ ngân hàng), <b>Rút quỹ</b>, <b>Điều chỉnh quỹ</b> <span className="pill admin">Admin</span>.</li>
                <li><b>Tuổi nợ</b>, danh sách <b>nhắc nợ</b>, và <b>hẹn trả nợ</b> (đánh dấu Đã trả / Thất hứa).</li>
                <li><b>Sổ quỹ gần đây</b> liệt kê mọi khoản thu–chi kèm nhãn nghiệp vụ (Thu nợ, Bán hàng, Chi phí, <b>Hoàn tiền trả hàng</b>, <b>Rút số dư trả khách</b>…).</li>
              </ul>
            </section>

            {/* 12 */}
            <section className="sec" id="s12" style={{ display: search && !filteredToc.find(t => t.id === "s12") ? "none" : "block" }}>
              <div className="hd"><span className="num">12</span><h2>Chi phí &amp; báo cáo</h2></div>
              <p className="sub">Ghi chi phí vận hành và xem kết quả kinh doanh theo kỳ.</p>
              <ul className="plain">
                <li><b>Thêm chi phí:</b> chọn loại chi phí, nguồn tiền (tiền mặt/ngân hàng), số tiền, ghi chú.</li>
                <li><b>Báo cáo:</b> Doanh thu — Giá vốn — Lợi nhuận gộp — Chi phí — <b>Lợi nhuận ròng ước tính</b>, kèm bảng theo ngày.</li>
              </ul>
            </section>

            {/* 13 */}
            <section className="sec" id="s13" style={{ display: search && !filteredToc.find(t => t.id === "s13") ? "none" : "block" }}>
              <div className="hd"><span className="num">13</span><h2>Cấu hình &amp; Vận hành <span className="pill admin">Admin</span></h2></div>
              <p className="sub">Chỉ admin truy cập. Nơi thiết lập cửa hàng, người dùng, sao lưu và các công cụ vận hành.</p>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Mục</th><th>Dùng để</th></tr></thead>
                  <tbody>
                    <tr><td>Cấu hình chung</td><td>Tên cửa hàng, logo, thông tin in trên bill.</td></tr>
                    <tr><td>Thanh toán QR</td><td>Bật QR VietQR trên bill; khai báo ngân hàng, số tài khoản.</td></tr>
                    <tr><td>Đơn vị tính</td><td>Danh mục đơn vị dùng khi bán/nhập kho.</td></tr>
                    <tr><td>Người dùng</td><td>Thêm nhân viên, đặt vai trò và <b>tinh chỉnh từng quyền</b> (gồm quyền Trả hàng).</td></tr>
                    <tr><td>Dữ liệu &amp; backup</td><td>Đồng bộ Google Sheet, xem hàng chờ đồng bộ ngược từ Sheet.</td></tr>
                    <tr><td>Vận hành</td><td>Nhật ký hoạt động, dọn dữ liệu lịch sử, hình thức kho, <b>kiểm tra hệ thống</b>.</td></tr>
                    <tr><td>Giao diện</td><td>Đổi màu nền/chủ đề (sáng, tối, moss…).</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 14 */}
            <section className="sec" id="s14" style={{ display: search && !filteredToc.find(t => t.id === "s14") ? "none" : "block" }}>
              <div className="hd"><span className="num">14</span><h2>Quy trình mẫu: bán → thu → trả hàng</h2></div>
              <p className="sub">Một vòng đời điển hình của khách quen, cho thấy số dư &amp; trả hàng gắn kết với nhau thế nào.</p>
              <div className="flow">
                <div className="stp"><div className="k">Bước 1</div><div className="t">Bán hàng (POS)</div><div className="d">Lên đơn, thu tiền/ghi nợ, xuất bill. Kho tự trừ.</div></div>
                <div className="stp"><div className="k">Bước 2</div><div className="t">Khách gửi trước</div><div className="d">Lập phiếu thu vượt nợ → phần dư vào <b>số dư</b> khách.</div></div>
                <div className="stp"><div className="k">Bước 3</div><div className="t">Đơn sau dùng số dư</div><div className="d">Ở POS bấm “Dùng số dư”, chỉ thu phần còn thiếu.</div></div>
                <div className="stp"><div className="k">Bước 4</div><div className="t">Trả hàng lỗi</div><div className="d">Mở đơn → Trả hàng: hàng tốt về kho chính, hàng lỗi vào KHO-LOI.</div></div>
                <div className="stp"><div className="k">Bước 5</div><div className="t">Hoàn tiền</div><div className="d">Cấn nợ đơn → phần dư hoàn tiền mặt hoặc cộng số dư.</div></div>
              </div>
            </section>

            {/* 15 */}
            <section className="sec" id="s15" style={{ display: search && !filteredToc.find(t => t.id === "s15") ? "none" : "block" }}>
              <div className="hd"><span className="num">15</span><h2>Dành cho quản trị (kỹ thuật)</h2></div>
              <p className="sub">Phần này dành cho admin/kỹ thuật vận hành hệ thống, không cần cho nhân viên bán hàng.</p>
              <div className="call warn">
                <p className="ct"><span className="ic">⚠️</span> Kích hoạt tính năng Trả hàng &amp; Số dư</p>
                <p>Các nghiệp vụ mới cần chạy <b>một lần</b> tệp cơ sở dữ liệu <span className="path"><b>20260720_returns_customer_credit.sql</b></span> trên Supabase (SQL Editor). Trước khi chạy, nút “Trả hàng” và “Rút số dư” sẽ báo lỗi; các nghiệp vụ cũ (bán hàng, thu tiền) vẫn chạy bình thường.</p>
              </div>
              <ul className="plain">
                <li><b>Sao lưu:</b> dữ liệu tự đồng bộ sang Google Sheet; có thể bấm “Đồng bộ ngay” ở Cấu hình → Dữ liệu &amp; backup.</li>
                <li><b>Bảo mật:</b> không chia sẻ token/mật khẩu qua tin nhắn. Nếu lỡ lộ, hãy thu hồi &amp; tạo lại ngay.</li>
                <li><b>Kiểm tra hệ thống:</b> mục Vận hành → “Kiểm tra hệ thống” đối chiếu các bảng dữ liệu đã sẵn sàng chưa.</li>
              </ul>
            </section>
          </main>
        </div>
      </div>

      <footer>
        <div className="shell">
          <span>Cẩm nang vận hành — Phần mềm Quản lý Bán hàng</span>
          <span>© 2026 - Hướng dẫn sử dụng v2.1</span>
        </div>
      </footer>

      {/* Back to Top button */}
      <button 
        className={`back-to-top ${showTop ? "visible" : ""}`}
        onClick={scrollToTop}
        title="Lên đầu trang"
      >
        <ChevronUp size={24} />
      </button>
    </div>
  );
}
