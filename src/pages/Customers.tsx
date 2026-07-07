import React, { useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { Search, UserPlus } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";

export function Customers() {
  const { customers, addCustomer, orders } = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: "", phone: "", address: "", oldDebt: 0, creditLimit: 50000000
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) {
      alert("Vui lòng nhập tên và số điện thoại");
      return;
    }
    addCustomer({
      ...newCustomer,
      id: `KH${String(Date.now()).slice(-4)}`,
    } as Customer);
    setIsAddOpen(false);
    setNewCustomer({ name: "", phone: "", address: "", oldDebt: 0, creditLimit: 50000000 });
    alert("Thêm khách hàng thành công!");
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center sm:text-left">Danh sách Khách hàng</h1>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 rounded bg-[#006B68] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005a57] w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          Thêm khách hàng
        </button>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên, SĐT..."
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-[#006B68] outline-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã KH</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Khách Hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Điện thoại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Địa chỉ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nợ hiện tại</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn mức</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#006B68]">{customer.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-bold uppercase">{customer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{customer.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-red-600">
                      {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() : "0"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{customer.creditLimit.toLocaleString()}</td>
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
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Khách Hàng Mới">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách hàng (*)</label>
            <input 
              type="text" 
              value={newCustomer.name}
              onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại (*)</label>
            <input 
              type="tel" 
              value={newCustomer.phone}
              onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input 
              type="text" 
              value={newCustomer.address}
              onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nợ đầu kỳ</label>
              <input 
                type="number" 
                value={newCustomer.oldDebt}
                onChange={e => setNewCustomer({...newCustomer, oldDebt: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hạn mức nợ</label>
              <input 
                type="number" 
                value={newCustomer.creditLimit}
                onChange={e => setNewCustomer({...newCustomer, creditLimit: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button 
              type="button" 
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-[#006B68] text-white rounded-md text-sm font-medium hover:bg-[#005a57]"
            >
              Lưu khách hàng
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
