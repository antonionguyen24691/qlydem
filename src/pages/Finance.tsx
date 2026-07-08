import React, { useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { Bell, DollarSign, Wallet, FileText, Search, Plus, UserCircle, AlertCircle } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/auth";
import { getAuthHeaders } from "../lib/supabase";

export function Finance() {
  const { customers, orders, loadLiveData } = useDataStore();
  const { isAuthenticated } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedCustomerForReceipt, setSelectedCustomerForReceipt] = useState("");
  const [receiptAmount, setReceiptAmount] = useState<number | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);

  const totalReceivables = customers.reduce((acc, c) => acc + c.oldDebt, 0);
  const totalCashIn = orders.reduce((acc, order) => acc + order.paid, 0);
  const openDebtOrders = orders.filter((order) => order.total > order.paid);
  const debtReminders = customers
    .filter((customer) => customer.oldDebt > 0)
    .sort((a, b) => b.oldDebt - a.oldDebt)
    .slice(0, 8)
    .map((customer) => ({
      customer,
      orders: orders.filter((order) => order.customerId === customer.id && order.total > order.paid),
      priority: customer.oldDebt > customer.creditLimit && customer.creditLimit > 0 ? "Vượt hạn mức" : "Cần nhắc"
    }));

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(receiptAmount);
    if (!selectedCustomerForReceipt || amount <= 0) {
      alert("Vui lòng chọn khách hàng và nhập số tiền hợp lệ");
      return;
    }
    if (!isAuthenticated) {
      alert("Bạn cần đăng nhập Google trước khi thu nợ.");
      return;
    }

    setIsSavingReceipt(true);
    try {
      const response = await fetch("/api/receipts/create", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomerForReceipt,
          amount,
          paymentMethod: "CASH",
          note: "Thu nợ từ màn hình tài chính"
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không lưu được phiếu thu");
      }
      await loadLiveData();
    } catch (error) {
      alert(`Không ghi được phiếu thu lên server.\n\n${error instanceof Error ? error.message : "Lỗi không xác định"}`);
      setIsSavingReceipt(false);
      return;
    } finally {
      setIsSavingReceipt(false);
    }
    alert(`Lập phiếu thu thành công!\nSố tiền: ${amount.toLocaleString()} đ`);
    setIsReceiptOpen(false);
    setSelectedCustomerForReceipt("");
    setReceiptAmount('');
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 gap-3 sm:gap-4">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Tài chính & Công nợ</h1>
        <Button onClick={() => setIsReceiptOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Lập phiếu thu
        </Button>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4 sm:space-y-6">
        {/* Top KPI Cards (Bento Style) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Quỹ tiền mặt</span></div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate">{totalCashIn.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Tiền gửi NH</span></div>
            <div className="text-base sm:text-xl font-bold text-zinc-400 mt-1 truncate">Theo phiếu CK</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải thu</span></div>
            <div className="text-lg sm:text-2xl font-bold text-red-600 truncate">{totalReceivables.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải trả</span></div>
            <div className="text-base sm:text-xl font-bold text-zinc-400 mt-1 truncate">Chờ nhập NCC</div>
          </div>
        </div>

        {/* Reminders & Ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" /> Nhắc nợ cần xử lý
              </h2>
              <span className="text-xs font-medium bg-red-50 text-red-700 px-2 py-1 rounded-full">{openDebtOrders.length} đơn nợ</span>
            </div>
            
            <div className="space-y-3">
              {debtReminders.map(({ customer, orders: customerOrders, priority }) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50 hover:border-zinc-300 cursor-pointer transition-colors active:scale-[0.98]"
                >
                  <div className="mb-2 flex min-w-0 items-start gap-3 sm:mb-0">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <UserCircle className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words font-bold uppercase text-zinc-900">{customer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{customerOrders.length} đơn hàng còn nợ</div>
                    </div>
                  </div>
                  <div className="flex min-w-0 sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-0 border-zinc-200 pt-2 sm:pt-0">
                    <div className="max-w-full truncate font-bold text-red-600 text-base">{customer.oldDebt.toLocaleString()} ₫</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${priority === 'Vượt hạn mức' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {priority}
                    </div>
                  </div>
                </div>
              ))}
              {debtReminders.length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  <AlertCircle className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  Chưa có khách hàng đang nợ.
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col justify-center items-center text-center h-full min-h-[200px]">
            <h2 className="font-semibold text-zinc-500 uppercase tracking-wider text-sm mb-4">Tỷ lệ thu tiền</h2>
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="text-zinc-100" strokeWidth="12" fill="none" stroke="currentColor" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className="text-emerald-500 transition-all duration-1000 ease-in-out" 
                  strokeWidth="12" fill="none" stroke="currentColor"
                  strokeDasharray="351.858"
                  strokeDashoffset={351.858 - (351.858 * (orders.reduce((sum, order) => sum + order.total, 0) > 0 ? (totalCashIn / orders.reduce((sum, order) => sum + order.total, 0)) : 0))}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-zinc-900">
                  {orders.reduce((sum, order) => sum + order.total, 0) > 0
                    ? `${Math.round((totalCashIn / orders.reduce((sum, order) => sum + order.total, 0)) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 px-4">Tính trên tổng đã thu / tổng doanh số (Supabase).</p>
          </div>
        </div>

        {/* Debt Management Section */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col flex-1 min-h-[400px]">
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-bold text-zinc-900 text-lg">Chi tiết công nợ khách hàng</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm khách hàng..."
                className="pl-10"
              />
            </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:flex overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Khách hàng</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">SĐT</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nợ hiện tại</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hạn mức</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-zinc-900 uppercase">{customer.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500">{customer.phone}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                      {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() + ' ₫' : "0 ₫"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500 text-right">
                      {customer.creditLimit.toLocaleString()} ₫
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        customer.oldDebt > customer.creditLimit 
                          ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' 
                          : customer.oldDebt > 0 
                            ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                      }`}>
                        {customer.oldDebt > customer.creditLimit ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-3 p-3 sm:p-4 custom-scrollbar">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-white p-3 sm:p-4 rounded-xl border border-zinc-200 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex min-w-0 justify-between items-start mb-3 gap-3">
                  <div className="min-w-0">
                    <h3 className="mb-1 line-clamp-2 break-words text-base font-bold uppercase text-zinc-900">{customer.name}</h3>
                    <div className="truncate text-sm font-medium text-zinc-500">{customer.phone}</div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    customer.oldDebt > customer.creditLimit 
                      ? 'bg-red-50 text-red-700' 
                      : customer.oldDebt > 0 
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {customer.oldDebt > customer.creditLimit ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                  </span>
                </div>
                
                <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-100">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-400 mb-0.5">Nợ hiện tại</div>
                    <div className="truncate text-lg font-bold text-red-600 leading-none">{customer.oldDebt.toLocaleString()} ₫</div>
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="text-xs font-medium text-zinc-400 mb-0.5">Hạn mức</div>
                    <div className="truncate text-sm font-semibold text-zinc-700">{customer.creditLimit.toLocaleString()} ₫</div>
                  </div>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="text-center py-10 text-zinc-500">
                <p>Không tìm thấy khách hàng nào</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog 
        isOpen={!!selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        title="Công nợ khách hàng"
      >
        {selectedCustomer && (
          <div className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="text-sm text-zinc-500 mb-1">Khách hàng:</div>
                <div className="mb-3 break-words text-xl font-bold uppercase text-zinc-900">{selectedCustomer.name}</div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <span className="text-zinc-500">Mã KH:</span>
                    <span className="break-words text-right font-medium text-zinc-900">{selectedCustomer.id}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <span className="text-zinc-500">SĐT:</span>
                    <span className="break-words text-right font-medium text-zinc-900">{selectedCustomer.phone}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <span className="text-zinc-500">Địa chỉ:</span>
                    <span className="break-words text-right font-medium text-zinc-900">{selectedCustomer.address || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <span className="text-red-700 text-xs font-bold uppercase tracking-wider block mb-1">Nợ hiện tại</span>
                    <div className="font-bold text-red-600 text-2xl truncate">{selectedCustomer.oldDebt.toLocaleString()}</div>
                 </div>
                 <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider block mb-1">Hạn mức</span>
                    <div className="font-bold text-zinc-900 text-xl truncate">{selectedCustomer.creditLimit.toLocaleString()}</div>
                 </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 mb-3">5 đơn hàng gần nhất</h4>
                <div className="space-y-2">
                  {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).slice(0, 5).map(order => (
                    <div key={order.id} className="flex justify-between items-center text-sm border border-zinc-200 p-3 rounded-lg bg-white">
                      <div>
                        <div className="font-bold text-emerald-600">{order.id}</div>
                        <div className="text-xs text-zinc-500">{new Date(order.date).toLocaleDateString('vi-VN')}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">{order.total.toLocaleString()} ₫</div>
                        <div className="text-xs text-emerald-600 font-medium">Đã thu: {order.paid.toLocaleString()} ₫</div>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).length === 0 && (
                     <div className="text-sm text-zinc-500 text-center py-4 border border-zinc-200 border-dashed rounded-lg bg-zinc-50">Chưa có đơn hàng nào.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
               <Button 
                onClick={() => setSelectedCustomer(null)}
                variant="outline"
                className="flex-1"
              >
                Đóng
              </Button>
               <Button 
                onClick={() => {
                   setSelectedCustomerForReceipt(selectedCustomer.id);
                   setSelectedCustomer(null);
                   setIsReceiptOpen(true);
                }}
                className="flex-1"
              >
                Thu nợ
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Lập Phiếu Thu">
        <form onSubmit={handleReceiptSubmit} className="flex flex-col h-full">
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Chọn Khách hàng</label>
              <select 
                value={selectedCustomerForReceipt}
                onChange={(e) => setSelectedCustomerForReceipt(e.target.value)}
                className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              >
                <option value="">-- Chọn khách hàng --</option>
                {customers.filter(c => c.oldDebt > 0).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Nợ: {c.oldDebt.toLocaleString()} đ)
                  </option>
                ))}
              </select>
            </div>
            
            {selectedCustomerForReceipt && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-red-800">Số nợ hiện tại:</span>
                <span className="text-xl font-bold text-red-600">
                  {customers.find(c => c.id === selectedCustomerForReceipt)?.oldDebt.toLocaleString()} ₫
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Số tiền thu</label>
              <Input 
                type="number" 
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(Number(e.target.value) || '')}
                placeholder="0"
                required
                min={1000}
                className="text-lg font-bold text-emerald-600"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button 
              type="button" 
              onClick={() => setIsReceiptOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Hủy
            </Button>
            <Button 
              type="submit"
              disabled={isSavingReceipt}
              className="flex-1"
            >
              {isSavingReceipt ? "Đang xử lý..." : "Xác nhận thu tiền"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
