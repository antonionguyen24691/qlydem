import React, { useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { Search, UserPlus, Phone, MapPin, Receipt, Users } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

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

  const totalDebt = customers.reduce((sum, c) => sum + c.oldDebt, 0);
  const debtors = customers.filter(c => c.oldDebt > 0);

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
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b border-zinc-200 gap-4">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Khách hàng</h1>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Thêm khách hàng
        </Button>
      </div>

      <div className="p-4 sm:p-6 flex-1 overflow-hidden flex flex-col custom-scrollbar">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-zinc-500 mb-2">Tổng số khách hàng</div>
            <div className="text-2xl font-bold text-zinc-900">{customers.length}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-zinc-500 mb-2">Khách đang nợ</div>
            <div className="text-2xl font-bold text-red-600">{debtors.length}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-zinc-500 mb-2">Tổng công nợ</div>
            <div className="text-2xl font-bold text-red-600">{totalDebt.toLocaleString()} ₫</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên, SĐT..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 overflow-hidden flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mã KH</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tên Khách Hàng</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Điện thoại</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Địa chỉ</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nợ hiện tại</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hạn mức</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">{customer.id}</td>
                    <td className="px-5 py-4 text-sm text-zinc-900 font-bold uppercase">{customer.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500">{customer.phone}</td>
                    <td className="px-5 py-4 text-sm text-zinc-500">{customer.address || "-"}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-right text-red-600">
                      {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() + " ₫" : "0"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500 text-right">{customer.creditLimit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
          {filteredCustomers.map((customer) => (
            <div 
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 active:scale-[0.98] transition-transform"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-zinc-900 text-base uppercase mb-1">{customer.name}</h3>
                  <div className="text-sm font-medium text-emerald-600">{customer.id}</div>
                </div>
                {customer.oldDebt > 0 && (
                  <div className="text-right shrink-0 ml-4 bg-red-50 px-2 py-1 rounded-lg">
                    <div className="text-xs text-red-700 font-semibold mb-0.5">Nợ hiện tại</div>
                    <div className="text-sm font-bold text-red-600 leading-none">{customer.oldDebt.toLocaleString()} ₫</div>
                  </div>
                )}
              </div>
              <div className="space-y-2 mt-4 text-sm text-zinc-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                  {customer.phone}
                </div>
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Users className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>Không tìm thấy khách hàng nào</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog 
        isOpen={!!selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        title="Thông tin chi tiết"
      >
        {selectedCustomer && (
          <div className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500 block mb-1">Mã KH:</span>
                    <div className="font-bold text-emerald-600">{selectedCustomer.id}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-1">Điện thoại:</span>
                    <div className="font-bold text-zinc-900">{selectedCustomer.phone}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-500 block mb-1">Tên khách hàng:</span>
                    <div className="font-bold text-zinc-900 text-lg uppercase">{selectedCustomer.name}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-500 block mb-1">Địa chỉ:</span>
                    <div className="font-medium text-zinc-900">{selectedCustomer.address || "-"}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-6">
                 <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <span className="text-red-700 text-sm block mb-1 font-semibold">Nợ hiện tại</span>
                    <div className="font-bold text-red-600 text-xl">{selectedCustomer.oldDebt.toLocaleString()} ₫</div>
                 </div>
                 <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                    <span className="text-zinc-600 text-sm block mb-1 font-semibold">Hạn mức công nợ</span>
                    <div className="font-bold text-zinc-900 text-xl">{selectedCustomer.creditLimit.toLocaleString()} ₫</div>
                 </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-zinc-400" />
                  Lịch sử mua hàng gần đây
                </h4>
                <div className="space-y-2">
                  {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).slice(0, 5).map(order => (
                    <div key={order.id} className="flex justify-between items-center text-sm border border-zinc-200 p-3 rounded-lg hover:bg-zinc-50 transition-colors">
                      <div>
                        <div className="font-bold text-emerald-600 mb-0.5">{order.id}</div>
                        <div className="text-xs text-zinc-500 font-medium">{new Date(order.date).toLocaleDateString('vi-VN')}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">{order.total.toLocaleString()} ₫</div>
                        <div className="text-xs text-emerald-600 font-medium mt-0.5">Đã thu: {order.paid.toLocaleString()} ₫</div>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.customerId === selectedCustomer.id || o.customerName === selectedCustomer.name).length === 0 && (
                     <div className="text-sm text-zinc-500 text-center py-6 border border-zinc-200 border-dashed rounded-lg">Chưa có đơn hàng nào.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-100">
               <Button onClick={() => setSelectedCustomer(null)} variant="outline" className="w-full">
                 Đóng
               </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Khách Hàng">
        <form onSubmit={handleAddSubmit} className="flex flex-col h-full">
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tên khách hàng (*)</label>
              <Input 
                type="text" 
                value={newCustomer.name}
                onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                required
                placeholder="Nhập họ tên"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Số điện thoại (*)</label>
              <Input 
                type="tel" 
                value={newCustomer.phone}
                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                required
                placeholder="09..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Địa chỉ</label>
              <Input 
                type="text" 
                value={newCustomer.address}
                onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                placeholder="Số nhà, đường, quận..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nợ đầu kỳ</label>
                <Input 
                  type="number" 
                  value={newCustomer.oldDebt || ""}
                  onChange={e => setNewCustomer({...newCustomer, oldDebt: Number(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Hạn mức nợ</label>
                <Input 
                  type="number" 
                  value={newCustomer.creditLimit || ""}
                  onChange={e => setNewCustomer({...newCustomer, creditLimit: Number(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button type="button" onClick={() => setIsAddOpen(false)} variant="outline" className="flex-1">
              Hủy
            </Button>
            <Button type="submit" className="flex-1">
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
