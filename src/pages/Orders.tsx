import { useState, useMemo } from "react";
import { useDataStore, Order } from "../store/data";
import { Search, Filter, Settings2, Printer, X } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";

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
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b gap-4">
        <h1 className="text-xl font-bold text-gray-900 uppercase text-center sm:text-left">NHẬT KÝ BÁN HÀNG</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm..."
              className="pl-10 pr-4 py-2 border rounded-md text-sm w-full sm:w-64 focus:ring-2 focus:ring-[#006B68] outline-none"
            />
          </div>
          <button className="p-2 border rounded-md hover:bg-gray-50 shrink-0">
            <Filter className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 overflow-hidden flex flex-col">
        {/* Date Navigator */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {uniqueDates.slice(0, 7).map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                currentDate === date 
                  ? 'bg-[#006B68] text-white shadow-sm' 
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </button>
          ))}
          {uniqueDates.length > 7 && (
            <button className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-600 border hover:bg-gray-50 flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4" /> Chọn ngày khác
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg border shadow-sm mb-6 flex divide-x divide-gray-200 overflow-x-auto scrollbar-hide">
          <div className="p-3 flex-1 text-center min-w-[100px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Tổng doanh thu</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
              {dailyOrders.reduce((acc, o) => acc + o.total, 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[100px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Thực thu</div>
            <div className="text-base sm:text-lg font-bold text-green-600 truncate">
              {dailyOrders.reduce((acc, o) => acc + o.paid, 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[100px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Công nợ</div>
            <div className="text-base sm:text-lg font-bold text-red-600 truncate">
              {dailyOrders.reduce((acc, o) => acc + (o.total - o.paid), 0).toLocaleString()} ₫
            </div>
          </div>
          <div className="p-3 flex-1 text-center min-w-[80px]">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Số đơn hàng</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
              {dailyOrders.length}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Danh sách phiếu xuất</h2>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chứng từ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Khách hàng</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Đã thu</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-gray-50 group cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-[#006B68]">{order.id}</div>
                      <div className="text-xs text-gray-500">{new Date(order.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {order.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right hidden md:table-cell">
                      {order.paid.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'Đã thanh toán' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(`In hóa đơn ${order.id}`);
                        }}
                        className="text-gray-400 hover:text-[#006B68] p-1 rounded-full hover:bg-[#006B68]/10 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog 
        isOpen={!!selectedOrder} 
        onClose={() => setSelectedOrder(null)} 
        title={`Chi tiết đơn hàng ${selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Khách hàng:</span>
                <div className="font-medium text-gray-900">{selectedOrder.customerName}</div>
              </div>
              <div>
                <span className="text-gray-500">Thời gian:</span>
                <div className="font-medium text-gray-900">{new Date(selectedOrder.date).toLocaleString('vi-VN')}</div>
              </div>
              <div>
                <span className="text-gray-500">Trạng thái:</span>
                <div className={`font-medium ${selectedOrder.status === 'Đã thanh toán' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedOrder.status}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2 border-b pb-2">Danh sách sản phẩm</h4>
              <div className="space-y-3">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-gray-500">{item.quantity} {item.unit} x {item.price.toLocaleString()}</div>
                    </div>
                    <div className="font-medium text-gray-900">{item.total.toLocaleString()} đ</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng cộng:</span>
                <span className="font-bold text-gray-900">{selectedOrder.total.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Đã thanh toán:</span>
                <span className="font-bold text-green-600">{selectedOrder.paid.toLocaleString()} đ</span>
              </div>
              {selectedOrder.total - selectedOrder.paid > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Còn nợ:</span>
                  <span className="font-bold text-red-600">{(selectedOrder.total - selectedOrder.paid).toLocaleString()} đ</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
               <button 
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
