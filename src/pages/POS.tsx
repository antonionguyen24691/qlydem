import React, { useState } from "react";
import { usePOSStore } from "../store/pos";
import { useDataStore } from "../store/data";
import { useAuthStore } from "../store/auth";
import { Search, Trash2, Plus, Minus, X } from "lucide-react";

export function POS() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = usePOSStore();
  const { products, customers, loadLiveData } = useDataStore();
  const { secret } = useAuthStore();
  
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

  const subTotal = getCartTotal();
  const discountAmount = Math.round(subTotal * (discountPercent / 100));
  const finalTotal = subTotal - discountAmount;

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

    if (!secret) {
      alert("Chưa đăng nhập hoặc thiếu INTERNAL_API_SECRET.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": secret
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
    } catch (error) {
      alert(`Không ghi được đơn lên server.\n\n${error instanceof Error ? error.message : "Lỗi không xác định"}`);
      setIsCheckingOut(false);
      return;
    } finally {
      setIsCheckingOut(false);
    }

    const paymentName = paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    alert(`Thanh toán thành công đơn hàng!\n\nMã HĐ: ${newOrder.id}\nKhách hàng: ${newOrder.customerName}\nTổng thanh toán: ${finalTotal.toLocaleString()} đ\nĐã thu: ${newOrder.paid.toLocaleString()} đ\nGhi nợ: ${debtAmount.toLocaleString()} đ\nPhương thức: ${paymentName}\n\nĐã lưu vào Supabase.`);
    
    // Reset state
    clearCart();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setDiscountPercent(0);
    setCustomerPaid("");
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

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 border-b border-gray-200 gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Bán hàng mới</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleCancel}
            className="rounded bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Hủy đơn
          </button>
          <button 
            onClick={() => alert('Đã lưu nháp đơn hàng!')}
            className="rounded bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Lưu nháp
          </button>
          <button 
            onClick={() => alert('Chức năng thêm khách hàng mới đang được cập nhật')}
            className="rounded bg-[#006B68] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005a57]"
          >
            Khách mới
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left/Center Area */}
        <div className="flex flex-col flex-1 p-2 sm:p-4 lg:border-r gap-4 overflow-y-auto">
          {/* Search */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={searchTerm}
                onChange={handleSearch}
                className="w-full rounded-md border-0 py-3 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#006B68] outline-none" 
                placeholder="Tìm kiếm sản phẩm theo tên hoặc mã..." 
              />
            </div>
            {searchTerm && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {searchResults.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="whitespace-nowrap rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    {p.name} - {p.price.toLocaleString()}đ
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="text-sm text-gray-500 py-2 px-1">Không tìm thấy sản phẩm phù hợp.</div>
                )}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã Hàng</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Hàng</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ĐVT</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn Giá</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thành Tiền</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        Chưa có sản phẩm trong giỏ hàng. <br/> Nhập tên sản phẩm để thêm vào.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-1 rounded hover:bg-gray-200 text-gray-600"><Minus size={14}/></button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 rounded hover:bg-gray-200 text-gray-600"><Plus size={14}/></button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{item.price.toLocaleString()}đ</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{item.total.toLocaleString()}đ</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Checkout Panel */}
        <div className="w-full lg:w-96 p-4 bg-gray-50 flex flex-col lg:border-l overflow-y-auto shrink-0">
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-4">Khách hàng</h3>
            <div className="relative">
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-blue-50 border-blue-200">
                  <div>
                    <div className="font-medium text-sm text-blue-900">{selectedCustomer.name}</div>
                    <div className="text-xs text-blue-700">Nợ cũ: {selectedCustomer.oldDebt.toLocaleString()}đ</div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-blue-100 rounded text-blue-600">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <input 
                    type="text" 
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full rounded-md border-0 py-2 pl-3 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#006B68] sm:text-sm sm:leading-6 outline-none" 
                    placeholder="Khách lẻ (Tìm kiếm theo tên, SĐT...)" 
                  />
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(c => (
                        <div 
                          key={c.id} 
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="font-medium text-sm text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.phone} - Hạn mức: {c.creditLimit.toLocaleString()}</div>
                        </div>
                      ))}
                      {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).length === 0 && (
                        <div className="p-3 text-sm text-gray-500 text-center">Không tìm thấy khách hàng.</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 flex-1 flex flex-col">
            <h3 className="font-medium text-gray-900 mb-4">Thanh toán</h3>
            <div className="space-y-4 text-sm flex-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng tiền hàng ({cart.length} món)</span>
                <span className="font-medium">{subTotal.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Chiết khấu (%)</span>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={discountPercent} 
                  onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                  className="w-20 text-right rounded border border-gray-300 py-1 px-2 text-sm focus:ring-1 focus:ring-[#006B68] outline-none" 
                />
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Giảm giá</span>
                  <span>-{discountAmount.toLocaleString()} đ</span>
                </div>
              )}
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="font-medium text-gray-900 text-lg">Khách cần trả</span>
                <span className="font-bold text-[#006B68] text-2xl">{finalTotal.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-500">Khách thanh toán</span>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="0" 
                    value={customerPaid}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setCustomerPaid(val ? Number(val).toLocaleString() : "");
                    }}
                    className="w-32 text-right rounded border border-gray-300 py-1.5 px-2 font-medium focus:ring-1 focus:ring-[#006B68] outline-none pr-6" 
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">đ</span>
                </div>
              </div>
              {customerPaid && (
                <div className="flex justify-between items-center pt-1 text-gray-500">
                  <span>Tiền thừa trả khách</span>
                  <span className="font-medium">
                    {Math.max(0, Number(customerPaid.replace(/\D/g, "")) - finalTotal).toLocaleString()} đ
                  </span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex-1 rounded border py-2 text-center font-medium transition-colors ${
                    paymentMethod === "CASH" 
                      ? "bg-[#006B68]/10 text-[#006B68] border-[#006B68]" 
                      : "border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Tiền mặt
                </button>
                <button 
                  onClick={() => setPaymentMethod("TRANSFER")}
                  className={`flex-1 rounded border py-2 text-center font-medium transition-colors ${
                    paymentMethod === "TRANSFER" 
                      ? "bg-[#006B68]/10 text-[#006B68] border-[#006B68]" 
                      : "border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Chuyển khoản
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t space-y-3">
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full rounded bg-[#006B68] px-4 py-4 text-base font-bold text-white shadow-sm hover:bg-[#005a57] active:bg-[#004a48] transition-colors"
              >
                {isCheckingOut ? "Đang lưu..." : "Thanh toán (F9)"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
