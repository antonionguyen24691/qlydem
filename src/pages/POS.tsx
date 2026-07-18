import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePOSStore } from "../store/pos";
import { type Order, useDataStore } from "../store/data";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";
import { useUIStore } from "../store/ui";
import { getAuthHeaders } from "../lib/supabase";
import { canEditSalePrices } from "../lib/permissions";
import { defaultUnitOptions, loadUnitOptions } from "../lib/unitOptions";
import { Search, Trash2, Plus, Minus, X, ChevronDown, Package, Menu } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const POS_DRAFT_KEY = "pmql-pos-draft";
const POS_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type PaymentConfig = {
  enabled?: boolean;
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
  transferTemplate?: string;
};

function createTransferReference() {
  return `CK${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function vietQrUrl(payment: PaymentConfig, amount: number, reference: string, customerName: string) {
  if (!payment.enabled || !payment.bankBin || !payment.accountNumber || amount <= 0) return "";
  const content = (payment.transferTemplate || "Thanh toan {orderCode}")
    .replaceAll("{orderCode}", reference)
    .replaceAll("{customerName}", customerName || "Khach le");
  const params = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: content, accountName: payment.accountName ?? "" });
  return `https://img.vietqr.io/image/${encodeURIComponent(payment.bankBin)}-${encodeURIComponent(payment.accountNumber)}-qr_only.png?${params.toString()}`;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function POS() {
  const { cart, addToCart, removeFromCart, updateQuantity, updatePrice, updateUnit, clearCart, getCartTotal } = usePOSStore();
  const { products, customers, loadLiveData, upsertCustomerLocal } = useDataStore();
  const { isAuthenticated, user } = useAuthStore();
  const themeId = useThemeStore((state) => state.themeId);
  const isMoss = themeId === "moss";
  const isTerracotta = themeId === "terracotta";
  const usesMobileMockup = themeId === "moss" || themeId === "terracotta";
  const mobilePosClass = isTerracotta ? "pos-mobile-terracotta" : "pos-mobile-moss";
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const navigate = useNavigate();
  const draftPromptedRef = useRef(false);
  const checkoutKeyRef = useRef<string | undefined>(undefined);
  const transferReferenceRef = useRef<string>("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(products);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [mobileCategory, setMobileCategory] = useState("ALL");

  // Checkout states
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [customerPaid, setCustomerPaid] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    customerGroup: "RETAIL",
    creditLimit: "",
    note: ""
  });
  const [unitOptions, setUnitOptions] = useState(defaultUnitOptions);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({});

  const subTotal = getCartTotal();
  const discountAmount = Math.round(subTotal * (discountPercent / 100));
  const finalTotal = subTotal - discountAmount;
  const enteredPaidAmount = customerPaid.trim() ? Number(customerPaid.replace(/\D/g, "")) : finalTotal;
  // Khách lẻ không thể mang công nợ: xác nhận CK luôn thu đủ đúng tổng đơn và xuất bill.
  // Thu một phần vẫn dùng được sau khi đã chọn khách hàng để ghi công nợ còn lại.
  const isAnonymousTransfer = paymentMethod === "TRANSFER" && !selectedCustomer;
  const transferAmount = isAnonymousTransfer
    ? finalTotal
    : Math.min(finalTotal, Math.max(0, enteredPaidAmount || finalTotal));
  const transferReference = transferReferenceRef.current || "CK-POS";
  const hasPaymentQrConfig = Boolean(paymentConfig.enabled && paymentConfig.bankBin && paymentConfig.accountNumber);
  const transferQrUrl = paymentMethod === "TRANSFER"
    ? vietQrUrl(paymentConfig, transferAmount, transferReference, selectedCustomer?.name ?? "Khach le")
    : "";
  const canDiscount = canEditSalePrices(user);
  const normalizedPickerSearch = normalizeSearch(productPickerSearch.trim());
  const productPickerResults = products.filter((product) => {
    if (!normalizedPickerSearch) return true;
    return [product.name, product.code, product.invoiceName ?? "", product.category ?? "", product.size ?? ""]
      .some((value) => normalizeSearch(value).includes(normalizedPickerSearch));
  });
  const mobileCategories = React.useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 6) as string[],
    [products]
  );
  const mobileProducts = searchResults.filter((product) => mobileCategory === "ALL" || product.category === mobileCategory);

  const isProductUnavailable = (product: (typeof products)[number]) => {
    const status = (product.lifecycleStatus || product.status || "ACTIVE").toUpperCase();
    return ["HOLD", "DISCONTINUED", "INACTIVE"].includes(status);
  };

  const handleAddProduct = (product: (typeof products)[number]) => {
    if (isProductUnavailable(product)) return;
    addToCart(product);
  };

  useEffect(() => {
    setSearchResults(products);
  }, [products]);

  useEffect(() => {
    void loadUnitOptions().then(setUnitOptions).catch(() => setUnitOptions(defaultUnitOptions));
  }, []);

  const loadPaymentConfig = async () => {
    try {
      const response = await fetch("/api/settings?key=payment", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (response.ok && body.ok) setPaymentConfig(body.payment ?? {});
    } catch {
      setPaymentConfig({});
    }
  };

  useEffect(() => { void loadPaymentConfig(); }, []);

  useEffect(() => {
    if (!canDiscount && discountPercent !== 0) setDiscountPercent(0);
  }, [canDiscount, discountPercent]);

  useEffect(() => {
    if (draftPromptedRef.current || cart.length > 0) return;
    const rawDraft = window.localStorage.getItem(POS_DRAFT_KEY);
    if (!rawDraft) return;

    draftPromptedRef.current = true;
    try {
      const draft = JSON.parse(rawDraft);
      const savedAt = new Date(draft.savedAt ?? 0).getTime();
      if (!savedAt || Date.now() - savedAt > POS_DRAFT_TTL_MS) {
        window.localStorage.removeItem(POS_DRAFT_KEY);
        return;
      }
      if (!Array.isArray(draft.cart) || draft.cart.length === 0) return;
      const shouldRestore = window.confirm(`Có đơn nháp chưa thanh toán (${draft.cart.length} mặt hàng). Bạn có muốn khôi phục không?`);
      if (!shouldRestore) return;

      // Giải quyết lại từ dữ liệu sống để lấy giá/ĐVT/tồn hiện tại; nháp chỉ giữ id + số lượng.
      draft.cart.forEach((item: any) => {
        if (!item?.id) return;
        const product = products.find((candidate) => candidate.id === item.id);
        if (product) addToCart(product, Number(item.quantity) || 1);
      });
      const draftCustomerId = draft.customerId ?? draft.selectedCustomer?.id;
      setSelectedCustomer(draftCustomerId ? customers.find((candidate) => candidate.id === draftCustomerId) ?? null : null);
      setDiscountPercent(Number(draft.discountPercent) || 0);
      setPaymentMethod(draft.paymentMethod === "TRANSFER" ? "TRANSFER" : "CASH");
      setCustomerPaid(draft.customerPaid ?? "");
      window.localStorage.removeItem(POS_DRAFT_KEY);
    } catch {
      window.localStorage.removeItem(POS_DRAFT_KEY);
    }
  }, [addToCart, cart.length]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (!term.trim()) {
      setSearchResults(products);
      return;
    }
    const normalizedTerm = normalizeSearch(term);
    const filtered = products.filter((product) => {
      return [product.name, product.code, product.invoiceName ?? "", product.category ?? ""]
        .some((value) => normalizeSearch(value).includes(normalizedTerm));
    });
    setSearchResults(filtered);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán!");
      return;
    }
    if (discountPercent < 0 || discountPercent > 100) {
      alert("Chiết khấu phải nằm trong khoảng 0-100%.");
      return;
    }
    const amountPaid = paymentMethod === "TRANSFER" && !selectedCustomer
      ? finalTotal
      : (customerPaid.trim() ? Number(customerPaid.replace(/\D/g, "")) : finalTotal);
    const debtAmount = Math.max(0, finalTotal - amountPaid);
    if (!selectedCustomer && debtAmount > 0) {
      alert(`Khách còn thiếu ${debtAmount.toLocaleString("vi-VN")} đ. Hãy chọn hoặc tạo khách hàng trước khi hoàn tất để ghi nhận công nợ đúng.`);
      return;
    }

    let newOrder: Order = {
      id: `HD${String(Date.now()).slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      customerName: selectedCustomer ? selectedCustomer.name : "Khách lẻ",
      customerId: selectedCustomer ? selectedCustomer.id : undefined,
      total: finalTotal,
      paid: amountPaid,
      status: (debtAmount > 0) ? "Nợ" : "Đã thanh toán",
      items: cart.map(item => ({
        id: item.id,
        name: item.invoiceName || item.name,
        size: item.size || "",
        unit: item.unit || "",
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))
    };

    if (!isAuthenticated) {
      alert("Bạn cần đăng nhập Google trước khi tạo đơn.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const idempotencyKey = checkoutKeyRef.current ?? (window.crypto?.randomUUID?.() ?? `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      checkoutKeyRef.current = idempotencyKey;
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          paymentMethod,
          paidAmount: amountPaid,
          discountAmount: canDiscount ? discountAmount : 0,
          note: paymentMethod === "TRANSFER" ? `Xác nhận chuyển khoản: ${transferReferenceRef.current || "CK-POS"}` : undefined,
          idempotencyKey,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            // Chỉ có tác dụng khi tài khoản có quyền sửa giá bán (orders.price_override).
            unitPrice: canDiscount ? item.price : undefined,
            unit: canDiscount ? item.unit : undefined
          }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không tạo được đơn hàng");
      }
      const savedOrder = body.order;
      if (!savedOrder) throw new Error("Server không trả về đơn hàng vừa tạo.");
      newOrder = {
        dbId: savedOrder.id,
        id: savedOrder.code ?? newOrder.id,
        date: String(savedOrder.order_date ?? new Date().toISOString()).slice(0, 10),
        customerName: selectedCustomer?.name ?? "Khách lẻ",
        customerId: selectedCustomer?.id,
        total: Number(savedOrder.total_amount ?? finalTotal),
        paid: Number(savedOrder.paid_amount ?? amountPaid),
        status: Number(savedOrder.debt_amount ?? 0) > 0 ? "Nợ" : "Đã thanh toán",
        items: (body.items ?? []).map((item: any) => ({
          id: item.product_id,
          name: item.product_name,
          size: "",
          unit: item.unit ?? "",
          quantity: Number(item.quantity ?? 0),
          price: Number(item.unit_price ?? 0),
          total: Number(item.line_total ?? 0)
        }))
      };
      // Đơn đã ghi thành công: in bill ngay, dữ liệu nền tự làm mới để không chặn người bán.
      void loadLiveData();
      window.localStorage.removeItem(POS_DRAFT_KEY);
    } catch (error) {
      alert(`Không ghi được đơn lên server.\n\n${error instanceof Error ? error.message : "Lỗi không xác định"}`);
      setIsCheckingOut(false);
      return;
    } finally {
      setIsCheckingOut(false);
    }

    clearCart();
    checkoutKeyRef.current = undefined;
    setSelectedCustomer(null);
    setCustomerSearch("");
    setDiscountPercent(0);
    setCustomerPaid("");
    transferReferenceRef.current = "";
    setIsMobileCheckoutOpen(false);
    navigate(`/orders/${encodeURIComponent(newOrder.id)}/bill`, { state: { order: newOrder } });
  };

  const handleCancel = () => {
    if (window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) {
      clearCart();
      setSelectedCustomer(null);
      setCustomerSearch("");
      setDiscountPercent(0);
      setCustomerPaid("");
      checkoutKeyRef.current = undefined;
      transferReferenceRef.current = "";
    }
  };

  const selectTransfer = () => {
    setPaymentMethod("TRANSFER");
    if (!transferReferenceRef.current) transferReferenceRef.current = createTransferReference();
    if (!customerPaid && finalTotal > 0) setCustomerPaid(finalTotal.toLocaleString("vi-VN"));
    // Có thể admin vừa lưu QR ở tab Cấu hình khi POS vẫn đang mở.
    void loadPaymentConfig();
  };

  const handleSaveDraft = () => {
    if (cart.length === 0) {
      alert("Chưa có sản phẩm trong giỏ để lưu nháp.");
      return;
    }

    // Chỉ lưu id khách trên thiết bị (máy bán hàng thường dùng chung), không lưu SĐT/nợ/hạn mức.
    window.localStorage.setItem(POS_DRAFT_KEY, JSON.stringify({
      cart: cart.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })),
      customerId: selectedCustomer?.id,
      discountPercent,
      paymentMethod,
      customerPaid,
      savedAt: new Date().toISOString()
    }));
    alert("Đã lưu nháp đơn hàng trên thiết bị này.");
  };

  const handleClearSavedDraft = () => {
    window.localStorage.removeItem(POS_DRAFT_KEY);
    alert("Đã xóa đơn nháp đã lưu trên thiết bị này.");
  };

  const handleCreateCustomer = async () => {
    const name = newCustomer.name.trim();
    if (!name) {
      alert("Vui lòng nhập tên khách hàng.");
      return;
    }
    if (!isAuthenticated) {
      alert("Bạn cần đăng nhập trước khi tạo khách hàng.");
      return;
    }

    setIsSavingCustomer(true);
    try {
      const response = await fetch("/api/data/customers", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...newCustomer,
          name,
          creditLimit: Number(newCustomer.creditLimit.replace(/\D/g, "")) || 0,
          oldDebt: 0
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không tạo được khách hàng.");
      }

      const row = body.customer;
      const customer = {
        id: row.id,
        code: row.code,
        name: row.name ?? name,
        phone: row.phone ?? "",
        address: row.address ?? "",
        oldDebt: Number(row.current_debt ?? 0),
        creditLimit: Number(row.credit_limit ?? 0),
        note: row.note ?? "",
        customerGroup: row.customer_group ?? "RETAIL"
      };
      upsertCustomerLocal(customer);
      setSelectedCustomer(customer);
      setShowCustomerDropdown(false);
      setCustomerSearch("");
      setShowNewCustomerModal(false);
      setNewCustomer({ name: "", phone: "", address: "", customerGroup: "RETAIL", creditLimit: "", note: "" });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không tạo được khách hàng.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  return (
    <div data-mobile-page="pos" data-mobile-theme={themeId} className={`mobile-mockup-page ${mobilePosClass} flex h-[calc(100vh-64px)] flex-col bg-zinc-50 relative pb-20 lg:pb-0`}>
      <div className="hidden lg:flex lg:flex-row lg:items-center justify-between bg-white px-4 py-3 border-b border-zinc-200 gap-3 shrink-0">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button data-testid="pos-product-picker-open" variant="primary" size="sm" onClick={() => setShowProductPicker(true)}>
            <Package className="mr-1.5 h-4 w-4" />
            Chọn sản phẩm
          </Button>
          <Button variant="danger" size="sm" onClick={handleCancel}>Hủy đơn</Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>Lưu nháp</Button>
          <Button variant="outline" size="sm" onClick={handleClearSavedDraft}>Xóa nháp</Button>
          <Button variant="outline" size="sm" onClick={() => setShowNewCustomerModal(true)}>Khách mới</Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden relative">
        {/* Left/Center Area */}
        <div className="flex flex-col flex-1 p-0 lg:p-4 lg:border-r border-zinc-200 gap-4 overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 p-3 sm:p-4 shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <Input 
                type="text" 
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10" 
                placeholder="Tìm kiếm sản phẩm theo tên hoặc mã..." 
              />
            </div>
            {searchTerm && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {searchResults.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => handleAddProduct(p)}
                    disabled={isProductUnavailable(p)}
                    className="flex min-w-[220px] max-w-[320px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all"
                    title={`${p.name} - ${p.price.toLocaleString()}đ`}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-emerald-600 font-semibold">{p.price.toLocaleString()}đ</span>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="text-sm text-zinc-500 py-2 px-1">Không tìm thấy sản phẩm phù hợp.</div>
                )}
              </div>
            )}
          </div>

          <section className={`${usesMobileMockup ? "" : "hidden"} pos-mobile-catalog lg:hidden`} aria-label="Chọn sản phẩm bán">
            <div className="pos-mobile-search-row">
              <button
                type="button"
                className="pos-mobile-nav"
                onClick={() => setSidebarOpen(true)}
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-5 w-5" />
              </button>
              <label className="pos-mobile-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <input
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Quét mã hoặc tìm sản phẩm"
                  inputMode="search"
                />
              </label>
              {isMoss && (
                <button type="button" className="pos-mobile-scan" onClick={() => setShowProductPicker(true)} aria-label="Mở danh mục sản phẩm">
                  <Package className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="pos-mobile-categories hide-scrollbar" aria-label="Nhóm sản phẩm">
              <button type="button" onClick={() => setMobileCategory("ALL")} className={mobileCategory === "ALL" ? "is-active" : ""}>Tất cả</button>
              {mobileCategories.map((category) => (
                <button type="button" key={category} onClick={() => setMobileCategory(category)} className={mobileCategory === category ? "is-active" : ""}>{category}</button>
              ))}
            </div>
            <div className="pos-mobile-product-grid">
              {mobileProducts.map((product) => {
                const cartItem = cart.find((item) => item.id === product.id);
                const unavailable = isProductUnavailable(product);
                return (
                  <article key={product.id} className={`pos-mobile-product ${cartItem ? "is-selected" : ""} ${unavailable ? "is-disabled" : ""}`}>
                    <button type="button" disabled={unavailable} onClick={() => handleAddProduct(product)} className="pos-mobile-product-main">
                      <span className="pos-mobile-product-code">{product.code}</span>
                      <strong>{product.name}</strong>
                      <span className="pos-mobile-product-footer">
                        <span className="pos-mobile-product-price">{product.price.toLocaleString("vi-VN")} ₫</span>
                        <span className="pos-mobile-product-stock">tồn {product.stock.toLocaleString("vi-VN")} {product.unit || ""}</span>
                      </span>
                    </button>
                    {cartItem && (
                      <div className="pos-mobile-quantity" aria-label={`Số lượng ${product.name}`}>
                        <button type="button" onClick={() => cartItem.quantity <= 1 ? removeFromCart(cartItem.id) : updateQuantity(cartItem.id, cartItem.quantity - 1)} aria-label="Giảm số lượng"><Minus size={15} /></button>
                        <span>{cartItem.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)} aria-label="Tăng số lượng"><Plus size={15} /></button>
                      </div>
                    )}
                  </article>
                );
              })}
              {mobileProducts.length === 0 && <div className="pos-mobile-empty">Không tìm thấy sản phẩm phù hợp.</div>}
            </div>
          </section>

          {/* Cart Desktop */}
          <div className="hidden lg:flex bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 flex-1 flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="min-w-[760px] w-full table-fixed divide-y divide-zinc-200">
                <colgroup>
                  <col className="w-[118px]" />
                  <col />
                  <col className="w-[72px]" />
                  <col className="w-[124px]" />
                  <col className="w-[124px]" />
                  <col className="w-[136px]" />
                  <col className="w-[48px]" />
                </colgroup>
                <thead className="bg-zinc-50/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Mã</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Tên hàng</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">ĐVT</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase">SL</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">Đơn giá</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">Thành tiền</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-zinc-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-zinc-500">
                        <Package className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
                        <p className="font-medium text-zinc-900">Giỏ hàng trống</p>
                        <p className="text-sm">Tìm nhanh hoặc mở danh mục để chọn sản phẩm.</p>
                        <Button size="sm" className="mt-4" onClick={() => setShowProductPicker(true)}>Chọn sản phẩm</Button>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-3 py-3 align-top text-xs font-semibold text-emerald-700">
                          <span className="block truncate" title={item.code}>{item.code}</span>
                        </td>
                        <td className="px-3 py-3 align-top text-sm font-semibold leading-5 text-zinc-900">
                          <div className="line-clamp-3 break-words" title={item.name}>{item.name}</div>
                          {item.size && <div className="mt-1 text-xs font-medium text-zinc-500">{item.size}</div>}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-500">
                          {canDiscount ? (
                            <select
                              value={item.unit}
                              onChange={(event) => updateUnit(item.id, event.target.value)}
                              className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm uppercase outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                              {unitOptions.map((unit) => <option key={unit.code} value={unit.code}>{unit.code}</option>)}
                              {!unitOptions.some((unit) => unit.code === item.unit) && <option value={item.unit}>{item.unit}</option>}
                            </select>
                          ) : (
                            item.unit
                          )}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-500 text-center">
                          <div className="flex items-center justify-center gap-1 bg-zinc-100 rounded-md p-0.5 w-fit mx-auto">
                            <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-zinc-600 transition-all"><Minus size={14}/></button>
                            <span className="w-8 text-center font-semibold text-zinc-900">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-zinc-600 transition-all"><Plus size={14}/></button>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-600 text-right">
                          <Input
                            type="number"
                            min="0"
                            value={item.price || ""}
                            readOnly={!canDiscount}
                            onChange={(event) => canDiscount && updatePrice(item.id, Number(event.target.value) || 0)}
                            className={`h-9 text-right font-semibold ${canDiscount ? "" : "bg-zinc-50 text-zinc-500"}`}
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm font-bold text-zinc-900 text-right">{item.total.toLocaleString()}đ</td>
                        <td className="px-2 py-3 align-top whitespace-nowrap text-sm text-center">
                          <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cart Mobile (Card List) */}
          <div className={`${usesMobileMockup ? "hidden" : "lg:hidden"} flex-col gap-3 pb-8`}>
            {cart.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-zinc-500 ring-1 ring-zinc-200">
                <Package className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
                <p className="font-medium text-zinc-900">Giỏ hàng trống</p>
                <p className="text-sm">Tìm nhanh hoặc mở danh mục để chọn sản phẩm.</p>
                <Button size="sm" className="mt-4" onClick={() => setShowProductPicker(true)}>Chọn sản phẩm</Button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm ring-1 ring-zinc-200 flex flex-col gap-3">
                  <div className="flex min-w-0 justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="line-clamp-2 break-words text-base font-semibold text-zinc-900">{item.name}</h4>
                      <p className="truncate text-sm text-zinc-500">{item.code} • {item.unit}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="p-2 text-zinc-400 hover:text-red-600 bg-zinc-50 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {canDiscount && (
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Đơn vị tính</div>
                      <select
                        value={item.unit}
                        onChange={(event) => updateUnit(item.id, event.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-[16px] uppercase outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {unitOptions.map((unit) => <option key={unit.code} value={unit.code}>{unit.name} ({unit.code})</option>)}
                        {!unitOptions.some((unit) => unit.code === item.unit) && <option value={item.unit}>ĐVT cũ: {item.unit}</option>}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] items-end gap-3 pt-2 border-t border-zinc-100">
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Giá bán</div>
                      <Input
                        type="number"
                        min="0"
                        value={item.price || ""}
                        readOnly={!canDiscount}
                        onChange={(event) => canDiscount && updatePrice(item.id, Number(event.target.value) || 0)}
                        className={`h-10 text-right font-semibold ${canDiscount ? "" : "bg-zinc-50 text-zinc-500"}`}
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
                      <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-2 rounded-md hover:bg-white hover:shadow-sm text-zinc-600"><Minus size={16}/></button>
                      <span className="w-10 text-center font-semibold text-zinc-900 text-base">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm text-zinc-600"><Plus size={16}/></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-500">Thành tiền</span>
                    <span className="max-w-[150px] truncate text-lg font-bold text-emerald-600">{item.total.toLocaleString()}đ</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Checkout Toggle Bar */}
        {usesMobileMockup ? <div className="pos-mobile-checkout-dock lg:hidden">
          <button type="button" className="pos-mobile-cart-summary" onClick={() => setIsMobileCheckoutOpen(true)}>
            <span className="pos-mobile-cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            <span className="pos-mobile-customer">{selectedCustomer ? `${selectedCustomer.name} · nợ cũ ${selectedCustomer.oldDebt.toLocaleString("vi-VN")} đ` : "Khách lẻ · mở giỏ hàng"}</span>
            <ChevronDown size={16} />
          </button>
          <div className="pos-mobile-total-row">
            <span>Khách cần trả</span>
            <strong>{finalTotal.toLocaleString("vi-VN")} ₫</strong>
          </div>
          <div className="pos-mobile-payment-methods">
            <button type="button" className={paymentMethod === "CASH" && customerPaid !== "0" ? "is-active" : ""} onClick={() => { setPaymentMethod("CASH"); setCustomerPaid(""); }}>Tiền mặt</button>
            <button type="button" className={paymentMethod === "TRANSFER" ? "is-active" : ""} onClick={selectTransfer}>Chuyển khoản</button>
            <button type="button" className={customerPaid === "0" ? "is-active" : ""} onClick={() => { setPaymentMethod("CASH"); setCustomerPaid("0"); setIsMobileCheckoutOpen(true); }}>Ghi nợ</button>
          </div>
          <button type="button" className="pos-mobile-complete" disabled={cart.length === 0} onClick={() => setIsMobileCheckoutOpen(true)}>{isTerracotta ? "Thanh toán & in bill" : "Hoàn tất — In hóa đơn"}</button>
        </div> : <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 p-3 z-30 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex flex-col">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tổng thanh toán ({cart.length})</span>
            <span className="mt-1 max-w-[190px] truncate text-xl font-bold leading-none text-emerald-600">{finalTotal.toLocaleString()} đ</span>
          </div>
          <Button size="lg" onClick={() => setIsMobileCheckoutOpen(true)}>Thanh toán</Button>
        </div>}

        {/* Mobile Overlay Background */}
        {isMobileCheckoutOpen && (
          <div 
            className="fixed inset-0 z-40 bg-[var(--overlay-bg)] backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setIsMobileCheckoutOpen(false)}
          />
        )}

        {/* Right Checkout Panel (Bottom sheet on mobile, Sidebar on desktop) */}
        <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[var(--radius-dialog)] shadow-[0_-20px_40px_rgba(0,0,0,0.15)] lg:relative lg:w-[400px] lg:shadow-none lg:border-l lg:border-zinc-200 lg:rounded-none transition-transform duration-300 ease-out flex flex-col max-h-[90vh] lg:max-h-full ${isMobileCheckoutOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
          
          {/* Mobile Drag Handle */}
          <div className="flex justify-center pt-3 pb-1 lg:hidden" onClick={() => setIsMobileCheckoutOpen(false)}>
            <div className="w-12 h-1.5 bg-zinc-300 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
            <div className="bg-zinc-50 rounded-[var(--radius-card)] p-4 ring-1 ring-zinc-200/60">
              <h3 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Khách hàng</h3>
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 border rounded-[var(--radius-card)] bg-white border-emerald-200 ring-1 ring-emerald-500/20 shadow-sm">
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words text-sm font-semibold text-zinc-900">{selectedCustomer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Nợ cũ: <span className="text-red-600 font-medium">{selectedCustomer.oldDebt.toLocaleString()}đ</span></div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-zinc-100 rounded-[var(--radius-control)] text-zinc-500">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input 
                      type="text" 
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Khách lẻ (Tìm kiếm theo tên, SĐT...)" 
                    />
                    {showCustomerDropdown && customerSearch && (
                      <div className="absolute z-10 w-full bg-white border border-zinc-200 rounded-[var(--radius-card)] shadow-lg mt-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(c => (
                          <div 
                            key={c.id} 
                            className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-b-0"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch("");
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <div className="line-clamp-2 break-words text-sm font-semibold text-zinc-900">{c.name}</div>
                            <div className="truncate text-xs text-zinc-500">{c.phone} - Hạn mức: {c.creditLimit.toLocaleString()}</div>
                          </div>
                        ))}
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).length === 0 && (
                          <div className="p-3 text-sm text-zinc-500 text-center">Không tìm thấy khách hàng.</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-zinc-50 rounded-[var(--radius-card)] p-4 ring-1 ring-zinc-200/60 flex-1 flex flex-col">
              <h3 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Thanh toán</h3>
              <div className="space-y-4 text-sm flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Tổng tiền hàng</span>
                  <span className="font-semibold text-zinc-900">{subTotal.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Chiết khấu (%)</span>
                  <Input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={discountPercent} 
                    onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                    disabled={!canDiscount}
                    className="w-24 text-right !min-h-[36px] !h-9" 
                  />
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-red-600 font-medium bg-red-50 p-2 rounded-lg">
                    <span>Giảm giá</span>
                    <span>-{discountAmount.toLocaleString()} đ</span>
                  </div>
                )}
                
                <div className="pt-4 border-t border-zinc-200 border-dashed flex justify-between items-end">
                  <span className="font-bold text-zinc-900 text-base">Khách cần trả</span>
                  <span className="max-w-[190px] truncate text-2xl font-bold leading-none text-emerald-600 sm:text-3xl">{finalTotal.toLocaleString()} đ</span>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <span className="text-zinc-500 font-medium">Khách đưa</span>
                  <div className="relative">
                    <Input 
                      type="text" 
                      placeholder="0" 
                      value={customerPaid}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setCustomerPaid(val ? Number(val).toLocaleString() : "");
                      }}
                      className="w-36 text-right pr-8 font-semibold text-base" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">đ</span>
                  </div>
                </div>
                {customerPaid && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-zinc-500 font-medium">Tiền thừa</span>
                    <span className="font-semibold text-zinc-900">
                      {Math.max(0, Number(customerPaid.replace(/\D/g, "")) - finalTotal).toLocaleString()} đ
                    </span>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  <button 
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex-1 rounded-xl py-3 text-center font-semibold transition-all min-h-[48px] ${
                      paymentMethod === "CASH" 
                        ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600 shadow-sm" 
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    Tiền mặt
                  </button>
                  <button 
                    onClick={selectTransfer}
                    className={`flex-1 rounded-xl py-3 text-center font-semibold transition-all min-h-[48px] ${
                      paymentMethod === "TRANSFER" 
                        ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600 shadow-sm" 
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    Chuyển khoản
                  </button>
                </div>
                {paymentMethod === "TRANSFER" && (
                  <div className="mt-4 rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50/60 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-emerald-900">Phiếu thanh toán chuyển khoản</div>
                        <div className="mt-1 text-xs leading-5 text-emerald-800">Quét QR để thanh toán {transferAmount.toLocaleString("vi-VN")} đ. Mã đối chiếu: <span className="font-black">{transferReference}</span>.</div>
                        {!hasPaymentQrConfig && <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800">Chưa cấu hình QR ngân hàng. Vào Cấu hình → Thanh toán QR, điền thông tin rồi bấm Lưu cấu hình thanh toán.</div>}
                        {hasPaymentQrConfig && transferAmount <= 0 && <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800">Chưa tạo QR vì đơn đang 0 đ. Hãy thêm ít nhất một hàng hóa vào giỏ hoặc nhập số tiền chuyển khoản lớn hơn 0.</div>}
                      </div>
                        {transferQrUrl && <img src={transferQrUrl} alt="QR thanh toán chuyển khoản" className="mx-auto h-56 w-56 shrink-0 bg-white object-contain lg:mx-0" />}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 pb-4 lg:pb-0">
              <Button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                size="lg"
                className="w-full h-14 text-lg"
              >
                {isCheckingOut ? "Đang xử lý..." : paymentMethod === "TRANSFER" ? "Xác nhận CK & xuất kho" : "Hoàn tất thanh toán"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showProductPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay-bg)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-picker-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowProductPicker(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[var(--radius-dialog)] bg-white shadow-[var(--shadow-dialog)] ring-1 ring-zinc-200 sm:rounded-[var(--radius-dialog)]">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id="product-picker-title" className="text-lg font-bold text-zinc-900">Chọn sản phẩm bán</h2>
                <p className="mt-0.5 text-sm text-zinc-500">Bấm Thêm nhiều lần để tăng số lượng trong giỏ.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="rounded-[var(--radius-control)] p-2 text-zinc-500 hover:bg-zinc-100"
                aria-label="Đóng danh mục sản phẩm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="border-b border-zinc-100 p-4 sm:px-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={productPickerSearch}
                  onChange={(event) => setProductPickerSearch(event.target.value)}
                  className="pl-10 rounded-[var(--radius-search)]"
                  placeholder="Tìm theo mã, tên hàng, quy cách..."
                  autoFocus
                />
              </div>
              <div className="mt-2 text-xs font-medium text-zinc-500">
                {productPickerResults.length.toLocaleString("vi-VN")} sản phẩm • {cart.length.toLocaleString("vi-VN")} mặt hàng trong giỏ
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productPickerResults.map((product) => {
                  const cartItem = cart.find((item) => item.id === product.id);
                  const unavailable = isProductUnavailable(product);
                  return (
                    <div
                      key={product.id}
                      className={`flex min-w-0 flex-col rounded-[var(--radius-card)] border p-3 shadow-sm ${unavailable ? "border-zinc-200 bg-zinc-50 opacity-70" : "border-zinc-200 bg-white hover:border-emerald-300"}`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold uppercase tracking-wide text-emerald-700" title={product.code}>{product.code}</div>
                          <div className="mt-1 line-clamp-2 min-h-10 break-words text-sm font-bold leading-5 text-zinc-900" title={product.name}>{product.name}</div>
                        </div>
                        {cartItem && (
                          <span className="shrink-0 rounded-full bg-[var(--cart-badge-bg)] px-2 py-1 text-xs font-black text-[var(--cart-badge-text)]">Đã chọn {cartItem.quantity}</span>
                        )}
                      </div>
                      <div className="mt-2 min-h-8 text-xs text-zinc-500">
                        {[product.size, product.category].filter(Boolean).join(" • ") || "Chưa phân loại"}
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3 border-t border-zinc-100 pt-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-emerald-600">{product.price.toLocaleString("vi-VN")} đ</div>
                          <div className={`text-xs font-semibold ${product.stock <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                            Tồn {product.stock.toLocaleString("vi-VN")} {product.unit}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddProduct(product)}
                          disabled={unavailable}
                          className="shrink-0"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          {unavailable ? "Ngưng bán" : "Thêm"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {productPickerResults.length === 0 && (
                <div className="py-14 text-center text-sm text-zinc-500">
                  <Package className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
                  Không tìm thấy sản phẩm phù hợp.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
              <div className="min-w-0 text-sm text-zinc-600">
                Tổng giỏ: <span className="font-black text-zinc-900">{cart.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("vi-VN")}</span>
              </div>
              <Button type="button" onClick={() => setShowProductPicker(false)}>Xong</Button>
            </div>
          </div>
        </div>
      )}

      {showNewCustomerModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay-bg)] p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-t-[var(--radius-dialog)] bg-white shadow-[var(--shadow-dialog)] ring-1 ring-zinc-200 sm:rounded-[var(--radius-dialog)]">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Thêm khách hàng nhanh</h2>
                <p className="text-sm text-zinc-500">Tạo khách và chọn ngay cho đơn bán hiện tại.</p>
              </div>
              <button onClick={() => setShowNewCustomerModal(false)} className="rounded-[var(--radius-control)] p-2 text-zinc-500 hover:bg-zinc-100">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-zinc-700">Tên khách hàng</span>
                <Input value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} autoFocus />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-zinc-700">Điện thoại</span>
                <Input value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-zinc-700">Hạn mức nợ</span>
                <Input
                  value={newCustomer.creditLimit}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setNewCustomer({ ...newCustomer, creditLimit: value ? Number(value).toLocaleString() : "" });
                  }}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-zinc-700">Địa chỉ</span>
                <Input value={newCustomer.address} onChange={(event) => setNewCustomer({ ...newCustomer, address: event.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-zinc-700">Ghi chú</span>
                <textarea
                  value={newCustomer.note}
                  onChange={(event) => setNewCustomer({ ...newCustomer, note: event.target.value })}
                  className="min-h-20 w-full rounded-[var(--radius-control)] border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 p-5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowNewCustomerModal(false)}>Đóng</Button>
              <Button onClick={handleCreateCustomer} disabled={isSavingCustomer}>
                {isSavingCustomer ? "Đang lưu..." : "Tạo và chọn khách"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
