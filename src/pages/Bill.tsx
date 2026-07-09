import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Printer, Share2, Table2 } from "lucide-react";
import type { Order } from "../store/data";
import { useDataStore } from "../store/data";
import { Button } from "../components/ui/Button";
import { exportSalesOrderXlsx, printSalesOrder, shareSalesOrderImage } from "../lib/printBill";

function money(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")} đ`;
}

export function Bill() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const orders = useDataStore((state) => state.orders);
  const loadLiveData = useDataStore((state) => state.loadLiveData);
  const stateOrder = (location.state as { order?: Order } | null)?.order;
  const decodedOrderId = orderId ? decodeURIComponent(orderId) : "";

  useEffect(() => {
    if (!orders.some((order) => order.id === decodedOrderId)) {
      void loadLiveData();
    }
  }, [decodedOrderId, loadLiveData, orders]);

  const order = useMemo(() => {
    return stateOrder ?? orders.find((item) => item.id === decodedOrderId) ?? null;
  }, [decodedOrderId, orders, stateOrder]);

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-zinc-50">
        <div className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => navigate("/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <div className="text-xl font-black text-zinc-900">Đang đồng bộ dữ liệu bill</div>
            <div className="mt-2 text-sm text-zinc-500">Nếu bill chưa hiện, mở lại từ danh sách đơn hàng.</div>
          </div>
        </div>
      </div>
    );
  }

  const debt = Math.max(0, order.total - order.paid);
  const downloadXlsx = () => {
    void exportSalesOrderXlsx(order).catch((error) => {
      alert(error instanceof Error ? error.message : "Không xuất được file XLSX.");
    });
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/pos")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-zinc-900">Bill {order.id}</h1>
              <div className="truncate text-sm text-zinc-500">{order.customerName} · {money(order.total)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" onClick={() => printSalesOrder(order)}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF/In
            </Button>
            <Button onClick={downloadXlsx}>
              <Table2 className="mr-2 h-4 w-4" />
              XLSX
            </Button>
            <Button variant="outline" onClick={() => void shareSalesOrderImage(order)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share ảnh
            </Button>
            <Button variant="outline" onClick={() => navigate("/pos")}>
              <Printer className="mr-2 h-4 w-4" />
              Bán tiếp
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
        <div className="mx-auto max-w-5xl rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-lg font-black uppercase text-zinc-900">Phiếu xuất bán hàng</div>
                <div className="mt-1 text-sm text-zinc-500">Ngày {new Date(order.date).toLocaleDateString("vi-VN")}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                <div><span className="text-zinc-500">Số phiếu:</span> <span className="font-bold text-zinc-900">{order.id}</span></div>
                <div className="mt-1"><span className="text-zinc-500">Trạng thái:</span> <span className="font-bold text-zinc-900">{order.status}</span></div>
              </div>
            </div>
            <div className="mt-6 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-[120px_1fr]">
              <div className="font-bold text-zinc-500">Bên mua</div>
              <div className="font-black uppercase text-zinc-900">{order.customerName}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-center">STT</th>
                  <th className="px-4 py-3 text-left">Hàng hóa</th>
                  <th className="px-4 py-3 text-center">ĐVT</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {order.items.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="px-4 py-4 text-center font-semibold text-zinc-500">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-zinc-900">{item.name}</div>
                      {item.size && <div className="mt-1 text-xs text-zinc-500">{item.size}</div>}
                    </td>
                    <td className="px-4 py-4 text-center text-zinc-600">{item.unit}</td>
                    <td className="px-4 py-4 text-right font-semibold">{item.quantity.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-4 text-right">{money(item.price)}</td>
                    <td className="px-4 py-4 text-right font-black text-zinc-900">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 border-t border-zinc-200 p-5 sm:p-8 lg:grid-cols-[1fr_360px]">
            <div className="grid grid-cols-3 gap-4 text-center">
              {["Kế toán/Bên giao", "Người giao hàng", "Bên nhận hàng"].map((label) => (
                <div key={label} className="min-h-[140px] rounded-xl border border-dashed border-zinc-300 p-3">
                  <div className="font-bold text-zinc-900">{label}</div>
                  <div className="mt-1 text-xs text-zinc-500">Ký, ghi rõ họ tên</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex justify-between py-2"><span>Tổng cộng</span><span className="font-black">{money(order.total)}</span></div>
              <div className="flex justify-between border-t border-zinc-200 py-2"><span>Đã thu</span><span className="font-black text-emerald-600">{money(order.paid)}</span></div>
              <div className="flex justify-between border-t border-zinc-200 py-2"><span>Còn nợ</span><span className="font-black text-red-600">{money(debt)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
