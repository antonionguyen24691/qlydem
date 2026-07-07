import React, { useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { DollarSign, Wallet, FileText, Search } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { useAuthStore } from "../store/auth";

export function Finance() {
  const { customers, orders, loadLiveData } = useDataStore();
  const { secret } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedCustomerForReceipt, setSelectedCustomerForReceipt] = useState("");
  const [receiptAmount, setReceiptAmount] = useState<number | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);

  const totalReceivables = customers.reduce((acc, c) => acc + c.oldDebt, 0);

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
    if (!secret) {
      alert("Chưa đăng nhập hoặc thiếu INTERNAL_API_SECRET.");
      return;
    }

    setIsSavingReceipt(true);
    try {
      const response = await fetch("/api/receipts/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": secret
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
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center sm:text-left">Quản lý Tài chính & Công nợ</h1>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg border shadow-sm mb-6 flex divide-x divide-gray-200 overflow-x-auto scrollbar-hide">
          <div className="p-3 flex-1 text-center min-w-[120px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap flex justify-center items-center gap-1"><DollarSign className="w-3 h-3"/> Quỹ tiền mặt</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">125,500,000 đ</div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[120px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap flex justify-center items-center gap-1"><Wallet className="w-3 h-3"/> Tiền gửi NH</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">340,000,000 đ</div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[120px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap flex justify-center items-center gap-1"><FileText className="w-3 h-3"/> Tổng phải thu</div>
            <div className="text-base sm:text-lg font-bold text-red-600 truncate">{totalReceivables.toLocaleString()} đ</div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[120px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap flex justify-center items-center gap-1"><FileText className="w-3 h-3"/> Tổng phải trả</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">45,000,000 đ</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-900">Chi tiết công nợ khách hàng</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm khách hàng..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-[#006B68] outline-none"
                />
              </div>
              <button 
                onClick={() => setIsReceiptOpen(true)}
                className="px-4 py-1.5 bg-[#006B68] text-white text-sm font-medium rounded hover:bg-[#005a57] whitespace-nowrap text-center"
              >
                Lập phiếu thu
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khách hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SĐT</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nợ hiện tại</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn mức</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 text-right">
                      {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() : "0"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {customer.creditLimit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        customer.oldDebt > customer.creditLimit 
                          ? 'bg-red-100 text-red-800' 
                          : customer.oldDebt > 0 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.oldDebt > customer.creditLimit ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog 
        isOpen={!!selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        title="Thông tin chi tiết khách hàng"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Mã KH:</span>
                <div className="font-medium text-[#006B68]">{selectedCustomer.id}</div>
              </div>
              <div>
                <span className="text-gray-500">Tên khách hàng:</span>
                <div className="font-medium text-gray-900 uppercase">{selectedCustomer.name}</div>
              </div>
              <div>
                <span className="text-gray-500">Số điện thoại:</span>
                <div className="font-medium text-gray-900">{selectedCustomer.phone}</div>
              </div>
              <div>
                <span className="text-gray-500">Địa chỉ:</span>
                <div className="font-medium text-gray-900">{selectedCustomer.address}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b py-4">
               <div>
                  <span className="text-gray-500 text-sm">Nợ hiện tại</span>
                  <div className="font-bold text-red-600 text-lg">{selectedCustomer.oldDebt.toLocaleString()} đ</div>
               </div>
               <div>
                  <span className="text-gray-500 text-sm">Hạn mức công nợ</span>
                  <div className="font-medium text-gray-900">{selectedCustomer.creditLimit.toLocaleString()} đ</div>
               </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Lịch sử mua hàng gần đây</h4>
              <div className="space-y-2">
                {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).slice(0, 5).map(order => (
                  <div key={order.id} className="flex justify-between items-center text-sm border p-3 rounded-md">
                    <div>
                      <div className="font-medium text-[#006B68]">{order.id}</div>
                      <div className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{order.total.toLocaleString()} đ</div>
                      <div className="text-xs text-green-600">Đã thu: {order.paid.toLocaleString()} đ</div>
                    </div>
                  </div>
                ))}
                {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).length === 0 && (
                   <div className="text-sm text-gray-500 text-center py-4 border rounded-md">Chưa có đơn hàng nào.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
               <button 
                onClick={() => {
                   setSelectedCustomerForReceipt(selectedCustomer.id);
                   setSelectedCustomer(null);
                   setIsReceiptOpen(true);
                }}
                className="px-4 py-2 bg-[#006B68] text-white rounded-md text-sm font-medium hover:bg-[#005a57] mr-2"
              >
                Thu nợ
              </button>
               <button 
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Lập Phiếu Thu Tiền">
        <form onSubmit={handleReceiptSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng</label>
            <select 
              value={selectedCustomerForReceipt}
              onChange={(e) => setSelectedCustomerForReceipt(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              required
            >
              <option value="">-- Chọn khách hàng --</option>
              {customers.filter(c => c.oldDebt > 0).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Nợ: {c.oldDebt.toLocaleString()} đ
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thu</label>
            <input 
              type="number" 
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(Number(e.target.value))}
              placeholder="Nhập số tiền..."
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              required
              min={1000}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button 
              type="button" 
              onClick={() => setIsReceiptOpen(false)}
              className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isSavingReceipt}
              className="px-4 py-2 bg-[#006B68] text-white rounded-md text-sm font-medium hover:bg-[#005a57]"
            >
              {isSavingReceipt ? "Đang lưu..." : "Lưu phiếu thu"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
