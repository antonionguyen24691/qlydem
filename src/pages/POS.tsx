import React, { useEffect, useRef, useState } from "react";
import { usePOSStore } from "../store/pos";
import { useDataStore } from "../store/data";
import { useAuthStore } from "../store/auth";
import { getAuthHeaders } from "../lib/supabase";
import { Search, Trash2, Plus, Minus, X, ChevronDown, Package } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { printSalesOrder } from "../lib/printBill";

const POS_DRAFT_KEY = "pmql-pos-draft";

export function POS() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = usePOSStore();
  const { products, customers, loadLiveData, upsertCustomerLocal } = useDataStore();
  const { isAuthenticated } = useAuthStore();
  const draftPromptedRef = useRef(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(products);

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

  const subTotal = getCartTotal();
  const discountAmount = Math.round(subTotal * (discountPercent / 100));
  const finalTotal = subTotal - discountAmount;

  useEffect(() => {
    setSearchResults(products);
  }, [products]);

  useEffect(() => {
    if (draftPromptedRef.current || cart.length > 0) return;
    const rawDraft = window.localStorage.getItem(POS_DRAFT_KEY);
    if (!rawDraft) return;

    draftPromptedRef.current = true;
    try {
      const draft = JSON.parse(rawDraft);
      if (!Array.isArray(draft.cart) || draft.cart.length === 0) return;
      const shouldRestore = window.confirm(`Có đơn nháp chưa thanh toán (${draft.cart.length} mặt hàng). Bạn có muốn khôi phục không?`);
      if (!shouldRestore) return;

      draft.cart.forEach((item: any) => {
        if (item?.id && item?.name) {
          addToCart(item, Number(item.quantity) || 1);
        }
      });
      setSelectedCustomer(draft.selectedCustomer ?? null);
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
    const filtered = products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()) || p.code.toLowerCase().includes(term.toLowerCase()));
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
    const amountPaid = customerPaid ? Number(customerPaid.replace(/\D/g, "")) : 0;
    const debtAmount = selectedCustomer ? Math.max(0, finalTotal - amountPaid) : 0;
    if (!selectedCustomer && debtAmount > 0) {
      alert("Đơn ghi nợ phải chọn khách hàng.");
      return;
    }

    const newOrder = {
      id: `HD${String(Date.now()).slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      customerName: selectedCustomer ? selectedCustomer.name : "Khách lẻ",
      customerId: selectedCustomer ? selectedCustomer.id : undefined,
      total: finalTotal,
      paid: selectedCustomer ? amountPaid : finalTotal,
      status: (debtAmount > 0) ? "Nợ" : "Đã thanh toán",
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
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
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          paymentMethod,
          paidAmount: selectedCustomer ? amountPaid : finalTotal,
          discountAmount,
          items: cart.map((item) => ({
            productId: item.id,
            productCode: item.code,
            productName: item.name,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.price
          }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không tạo được đơn hàng");
      }
      newOrder.id = body.order?.code ?? newOrder.id;
      await loadLiveData();
      window.localStorage.removeItem(POS_DRAFT_KEY);
    } catch (error) {
      alert(`Không ghi được đơn lên server.\n\n${error instanceof Error ? error.message : "Lỗi không xác định"}`);
      setIsCheckingOut(false);
      return;
    } finally {
      setIsCheckingOut(false);
    }

    const paymentName = paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    const shouldPrint = window.confirm(`Thanh toán thành công đơn hàng!\n\nMã HĐ: ${newOrder.id}\nKhách hàng: ${newOrder.customerName}\nTổng thanh toán: ${finalTotal.toLocaleString()} đ\nĐã thu: ${newOrder.paid.toLocaleString()} đ\nGhi nợ: ${debtAmount.toLocaleString()} đ\nPhương thức: ${paymentName}\n\nBạn có muốn in phiếu xuất/bill bán hàng ngay không?`);
    if (shouldPrint) printSalesOrder(newOrder);
    
    clearCart();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setDiscountPercent(0);
    setCustomerPaid("");
    setIsMobileCheckoutOpen(false);
  };

  const handleCancel = () => {
    if (window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) {
      clearCart();
      setSelectedCustomer(null);
      setCustomerSearch("");
      setDiscountPercent(0);
      setCustomerPaid("");
    }
  };

  const handleSaveDraft = () => {
    if (cart.length === 0) {
      alert("Chưa có sản phẩm trong giỏ để lưu nháp.");
      return;
    }

    window.localStorage.setItem(POS_DRAFT_KEY, JSON.stringify({
      cart,
      selectedCustomer,
      discountPercent,
      paymentMethod,
      customerPaid,
      savedAt: new Date().toISOString()
    }));
    alert("Đã lưu nháp đơn hàng trên thiết bị này.");
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
    <div className="flex h-[calc(100vh-64px)] flex-col bg-zinc-50 relative pb-20 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 border-b border-zinc-200 gap-3 shrink-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Bán hàng mới</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="danger" size="sm" onClick={handleCancel}>Hủy đơn</Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>Lưu nháp</Button>
          <Button variant="primary" size="sm" onClick={() => setShowNewCustomerModal(true)}>Khách mới</Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden relative">
        {/* Left/Center Area */}
        <div className="flex flex-col flex-1 p-2 sm:p-4 lg:border-r border-zinc-200 gap-4 overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 p-3 sm:p-4 shrink-0">
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
                    onClick={() => addToCart(p)}
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
                        <p className="text-sm">Nhập tên sản phẩm để thêm vào.</p>
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
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-500">{item.unit}</td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-500 text-center">
                          <div className="flex items-center justify-center gap-1 bg-zinc-100 rounded-md p-0.5 w-fit mx-auto">
                            <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-zinc-600 transition-all"><Minus size={14}/></button>
                            <span className="w-8 text-center font-semibold text-zinc-900">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-zinc-600 transition-all"><Plus size={14}/></button>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-sm text-zinc-600 text-right">{item.price.toLocaleString()}đ</td>
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
          <div className="lg:hidden flex flex-col gap-3 pb-8">
            {cart.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-zinc-500 ring-1 ring-zinc-200">
                <Package className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
                <p className="font-medium text-zinc-900">Giỏ hàng trống</p>
                <p className="text-sm">Nhập tên sản phẩm để thêm vào.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-zinc-200 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-semibold text-zinc-900 text-base">{item.name}</h4>
                      <p className="text-sm text-zinc-500">{item.code} • {item.unit} • {item.price.toLocaleString()}đ/đơn vị</p>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="p-2 text-zinc-400 hover:text-red-600 bg-zinc-50 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
                      <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-2 rounded-md hover:bg-white hover:shadow-sm text-zinc-600"><Minus size={16}/></button>
                      <span className="w-10 text-center font-semibold text-zinc-900 text-base">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm text-zinc-600"><Plus size={16}/></button>
                    </div>
                    <span className="font-bold text-emerald-600 text-lg">{item.total.toLocaleString()}đ</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Checkout Toggle Bar */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 p-3 z-30 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tổng thanh toán ({cart.length})</span>
            <span className="font-bold text-emerald-600 text-xl leading-none mt-1">{finalTotal.toLocaleString()} đ</span>
          </div>
          <Button size="lg" onClick={() => setIsMobileCheckoutOpen(true)}>
            Thanh toán
          </Button>
        </div>

        {/* Mobile Overlay Background */}
        {isMobileCheckoutOpen && (
          <div 
            className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setIsMobileCheckoutOpen(false)}
          />
        )}

        {/* Right Checkout Panel (Bottom sheet on mobile, Sidebar on desktop) */}
        <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-[0_-20px_40px_rgba(0,0,0,0.15)] lg:relative lg:w-[400px] lg:shadow-none lg:border-l lg:border-zinc-200 lg:rounded-none transition-transform duration-300 ease-out flex flex-col max-h-[90vh] lg:max-h-full ${isMobileCheckoutOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
          
          {/* Mobile Drag Handle */}
          <div className="flex justify-center pt-3 pb-1 lg:hidden" onClick={() => setIsMobileCheckoutOpen(false)}>
            <div className="w-12 h-1.5 bg-zinc-300 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
            <div className="bg-zinc-50 rounded-xl p-4 ring-1 ring-zinc-200/60">
              <h3 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Khách hàng</h3>
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 border rounded-xl bg-white border-emerald-200 ring-1 ring-emerald-500/20 shadow-sm">
                    <div>
                      <div className="font-semibold text-sm text-zinc-900">{selectedCustomer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Nợ cũ: <span className="text-red-600 font-medium">{selectedCustomer.oldDebt.toLocaleString()}đ</span></div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500">
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
                      <div className="absolute z-10 w-full bg-white border border-zinc-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto custom-scrollbar">
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
                            <div className="font-semibold text-sm text-zinc-900">{c.name}</div>
                            <div className="text-xs text-zinc-500">{c.phone} - Hạn mức: {c.creditLimit.toLocaleString()}</div>
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

            <div className="bg-zinc-50 rounded-xl p-4 ring-1 ring-zinc-200/60 flex-1 flex flex-col">
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
                  <span className="font-bold text-emerald-600 text-3xl leading-none">{finalTotal.toLocaleString()} đ</span>
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
                    onClick={() => setPaymentMethod("TRANSFER")}
                    className={`flex-1 rounded-xl py-3 text-center font-semibold transition-all min-h-[48px] ${
                      paymentMethod === "TRANSFER" 
                        ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600 shadow-sm" 
                        : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 pb-4 lg:pb-0">
              <Button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                size="lg"
                className="w-full h-14 text-lg"
              >
                {isCheckingOut ? "Đang xử lý..." : "Hoàn tất thanh toán"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showNewCustomerModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-900/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-t-2xl bg-white shadow-2xl ring-1 ring-zinc-200 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Thêm khách hàng nhanh</h2>
                <p className="text-sm text-zinc-500">Tạo khách và chọn ngay cho đơn bán hiện tại.</p>
              </div>
              <button onClick={() => setShowNewCustomerModal(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
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
                  className="min-h-20 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600"
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
