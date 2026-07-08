import { useState, useMemo } from "react";
import { useDataStore, Order } from "../store/data";
import { Search, Filter, Settings2, Printer, X, Receipt, ScrollText } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { printSalesOrder } from "../lib/printBill";

export function Orders() {
  const { orders } = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Lấy các ngày duy nhất từ orders
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(orders.map(o => o.date)));
    dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return dates;
  }, [orders]);

  // Set selectedDate mặc định là ngày đầu tiên nếu chưa chọn
  const currentDate = selectedDate || (uniqueDates.length > 0 ? uniqueDates[0] : "");

  const dailyOrders = useMemo(() => {
    return orders.filter(o => {
      const matchDate = o.date === currentDate;
      const matchSearch = 
        o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchSearch;
    });
  }, [currentDate, searchTerm, orders]);

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 gap-3 sm:gap-4">
        <h1 className="text-xl font-bold text-zinc-900 uppercase text-center sm:text-left">Nhật ký bán hàng</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm mã, tên..."
              className="pl-10 h-10 min-h-[40px] sm:h-9 sm:min-h-[36px]"
            />
          </div>
          <Button variant="outline" className="px-3 shrink-0 h-10 min-h-[40px] sm:h-9 sm:min-h-[36px]">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-hidden flex flex-col">
        {/* Date Navigator */}
        <div className="flex items-center gap-2 mb-3 sm:mb-6 overflow-x-auto pb-2 hide-scrollbar">
          {uniqueDates.slice(0, 7).map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${
                currentDate === date 
                  ? 'bg-zinc-900 text-white shadow-md shadow-zinc-900/10' 
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </button>
          ))}
          {uniqueDates.length > 7 && (
            <button className="px-4 py-2 rounded-full text-sm font-medium bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4" /> Chọn ngày khác
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mb-3 grid grid-cols-4 divide-x divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:mb-6">
          <div className="min-w-0 p-2 text-center sm:p-4">
            <div className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">Doanh thu</div>
            <div className="truncate text-sm font-bold text-zinc-900 sm:text-xl">
              {dailyOrders.reduce((acc, o) => acc + o.total, 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="min-w-0 p-2 text-center sm:p-4">
            <div className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">Thực thu</div>
            <div className="truncate text-sm font-bold text-emerald-600 sm:text-xl">
              {dailyOrders.reduce((acc, o) => acc + o.paid, 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="min-w-0 p-2 text-center sm:p-4">
            <div className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">Công nợ</div>
            <div className="truncate text-sm font-bold text-red-600 sm:text-xl">
              {dailyOrders.reduce((acc, o) => acc + (o.total - o.paid), 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="min-w-0 p-2 text-center sm:p-4">
            <div className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">Số đơn</div>
            <div className="truncate text-sm font-bold text-zinc-900 sm:text-xl">
              {dailyOrders.length}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
           <h2 className="font-bold text-zinc-900 text-lg flex items-center gap-2">
             <ScrollText className="w-5 h-5 text-emerald-600" />
             Danh sách đơn hàng
           </h2>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 overflow-hidden flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chứng từ</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Khách hàng</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng tiền</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Đã thu</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {dailyOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-zinc-50 group cursor-pointer transition-colors"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-emerald-600">{order.id}</div>
                      <div className="text-xs text-zinc-500 mt-1 font-medium">{new Date(order.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm font-semibold text-zinc-900">{order.customerName}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-zinc-900 text-right">
                      {order.total.toLocaleString()} ₫
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 text-right hidden lg:table-cell">
                      {order.paid.toLocaleString()} ₫
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'Đã thanh toán' 
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' 
                          : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          printSalesOrder(order);
                        }}
                        className="text-zinc-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors active:scale-95"
                      >
                        <Printer className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
          {dailyOrders.map((order) => (
            <div 
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white p-3 rounded-xl shadow-sm border border-zinc-200 active:scale-[0.98] transition-transform"
            >
              <div className="mb-3 flex min-w-0 items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate font-bold text-emerald-600">
                    <Receipt className="w-4 h-4" />
                    <span className="truncate">{order.id}</span>
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    {new Date(order.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  order.status === 'Đã thanh toán' 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'bg-red-50 text-red-700'
                }`}>
                  {order.status}
                </span>
              </div>
              
              <div className="mb-3">
                <div className="line-clamp-2 break-words text-sm font-semibold text-zinc-900">{order.customerName}</div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">Tổng thanh toán</div>
                  <div className="max-w-[220px] truncate text-lg font-bold text-zinc-900">{order.total.toLocaleString()} ₫</div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    printSalesOrder(order);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-50 text-zinc-600 border border-zinc-200 active:bg-zinc-100"
                >
                  <Printer className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {dailyOrders.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <ScrollText className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>Chưa có đơn hàng nào trong ngày này</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog 
        isOpen={!!selectedOrder} 
        onClose={() => setSelectedOrder(null)} 
        title={`Chi tiết đơn hàng ${selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500 block mb-1">Khách hàng:</span>
                    <div className="font-bold text-zinc-900">{selectedOrder.customerName}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-1">Thời gian:</span>
                    <div className="font-semibold text-zinc-900">{new Date(selectedOrder.date).toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-zinc-200">
                    <span className="text-zinc-500 block mb-1">Trạng thái:</span>
                    <div className={`font-bold inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                      selectedOrder.status === 'Đã thanh toán' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedOrder.status}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 mb-3 text-lg flex items-center gap-2">
                  <PackageSearch className="w-5 h-5 text-zinc-400" />
                  Danh sách sản phẩm
                </h4>
                <div className="space-y-3 bg-white border border-zinc-200 rounded-xl p-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm p-3 hover:bg-zinc-50 rounded-lg">
                      <div>
                        <div className="font-bold text-zinc-900">{item.name}</div>
                        <div className="text-zinc-500 mt-1">{item.quantity} {item.unit} x <span className="font-medium text-zinc-700">{item.price.toLocaleString()}</span></div>
                      </div>
                      <div className="font-bold text-emerald-600 text-base">{item.total.toLocaleString()} ₫</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 text-white rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-zinc-400 text-sm">
                  <span>Tổng tiền hàng:</span>
                  <span className="font-medium text-white">{selectedOrder.total.toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-sm">
                  <span>Khách đã trả:</span>
                  <span className="font-medium text-emerald-400">{selectedOrder.paid.toLocaleString()} ₫</span>
                </div>
                <div className="border-t border-zinc-700 pt-3 flex justify-between items-center">
                  <span className="font-medium text-zinc-300">CÒN PHẢI THU:</span>
                  <span className={`font-bold text-2xl ${
                    (selectedOrder.total - selectedOrder.paid) > 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    {(selectedOrder.total - selectedOrder.paid).toLocaleString()} ₫
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-100 grid grid-cols-2 gap-3">
               <Button 
                onClick={() => setSelectedOrder(null)}
                variant="outline"
              >
                Đóng
              </Button>
              <Button 
                onClick={() => printSalesOrder(selectedOrder)}
              >
                <Printer className="w-4 h-4 mr-2" /> In hóa đơn
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PackageSearch(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path d="M16.5 9.4 7.55 4.24" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" x2="12" y1="22" y2="12" />
      <circle cx="18.5" cy="15.5" r="2.5" />
      <path d="M20.27 17.27 22 19" />
    </svg>
  )
}
