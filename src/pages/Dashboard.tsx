import { TrendingUp, Users, Package, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ReactNode } from "react";
import { useDataStore } from "../store/data";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

export function Dashboard() {
  const { orders, products, customers, isLoadingLiveData, liveDataError } = useDataStore();
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayOrders = orders.filter((order) => startOfDay(new Date(order.date)).getTime() === today.getTime());
  const yesterdayOrders = orders.filter((order) => startOfDay(new Date(order.date)).getTime() === yesterday.getTime());
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + order.total, 0);
  const revenueDelta = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
  const lowStock = products.filter((product) => product.stock <= 0);
  const debtCustomers = customers.filter((customer) => customer.oldDebt > 0);
  const totalDebt = debtCustomers.reduce((sum, customer) => sum + customer.oldDebt, 0);

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const dayOrders = orders.filter((order) => order.date === key);
    return {
      key,
      label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
      count: dayOrders.length
    };
  });
  const maxRevenue = Math.max(1, ...last7Days.map((day) => day.revenue));

  const soldMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = soldMap.get(item.id) ?? { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.total;
      soldMap.set(item.id, current);
    }
  }
  const topProducts = Array.from(soldMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Tổng quan</h1>
        <p className="mt-1 text-sm text-zinc-500">Số liệu thật từ Supabase theo đơn hàng, tồn kho và công nợ.</p>
        {isLoadingLiveData && <p className="mt-2 text-sm text-blue-600">Đang tải dữ liệu thật...</p>}
        {liveDataError && <p className="mt-2 text-sm text-red-600">Lỗi dữ liệu: {liveDataError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Doanh thu hôm nay" value={money(todayRevenue)} icon={<DollarSign className="h-5 w-5" />} delta={revenueDelta} />
        <StatCard title="Đơn hàng hôm nay" value={String(todayOrders.length)} icon={<TrendingUp className="h-5 w-5" />} sub={`${yesterdayOrders.length} đơn hôm qua`} />
        <StatCard title="Sản phẩm hết kho" value={String(lowStock.length)} icon={<Package className="h-5 w-5" />} warning="Cần nhập/kiểm kho" />
        <StatCard title="Khách hàng nợ" value={String(debtCustomers.length)} icon={<Users className="h-5 w-5" />} sub={`Tổng nợ: ${money(totalDebt)}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 lg:col-span-4">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Doanh thu 7 ngày</h2>
            <span className="text-xs text-zinc-500">{orders.length} đơn hàng</span>
          </div>
          <div className="flex h-72 items-end gap-3 border-b border-l border-zinc-200 px-2 pb-2">
            {last7Days.map((day) => (
              <div key={day.key} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="text-center text-[11px] text-zinc-500">{day.count} đơn</div>
                <div className="relative flex flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-[#006B68]"
                    style={{ height: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%` }}
                    title={`${day.label}: ${money(day.revenue)}`}
                  />
                </div>
                <div className="text-center text-xs text-zinc-600">{day.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 lg:col-span-3">
          <h2 className="mb-5 text-base font-semibold text-zinc-900">Sản phẩm bán chạy</h2>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-900">{product.name}</div>
                    <div className="text-xs text-zinc-500">Đã bán {product.quantity.toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="text-right text-sm font-semibold text-[#006B68]">{money(product.revenue)}</div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">Chưa có dữ liệu bán hàng.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, delta, sub, warning }: { title: string; value: string; icon: ReactNode; delta?: number; sub?: string; warning?: string }) {
  const isUp = (delta ?? 0) >= 0;
  return (
    <div className="flex h-[140px] flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
        {delta !== undefined ? (
          <p className={`mt-2 flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            {isUp ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}% so với hôm qua
          </p>
        ) : (
          <p className={`mt-2 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${warning ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>{warning ?? sub}</p>
        )}
      </div>
    </div>
  );
}
