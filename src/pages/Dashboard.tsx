import { TrendingUp, Users, Package, DollarSign, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDataStore } from "../store/data";
import { useThemeStore } from "../store/theme";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

export function Dashboard() {
  const themeId = useThemeStore((state) => state.themeId);
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
  const topDebtCustomers = [...debtCustomers].sort((a, b) => b.oldDebt - a.oldDebt).slice(0, 4);

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
    <div data-mobile-page="dashboard" data-mobile-theme={themeId} className="mobile-mockup-page relative mx-auto w-full max-w-7xl p-3 pb-24 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Tổng quan</h1>
        <p className="mt-1 text-sm text-zinc-500">Số liệu được đồng bộ theo đơn hàng, tồn kho và công nợ.</p>
        {isLoadingLiveData && <p className="mt-2 text-sm text-emerald-600">Đang đồng bộ dữ liệu...</p>}
        {liveDataError && <p className="mt-2 text-sm text-red-600">Lỗi dữ liệu: {liveDataError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Link to="/expenses?tab=REPORT" className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><StatCard title="Doanh thu hôm nay" value={money(todayRevenue)} icon={<DollarSign className="h-5 w-5" />} delta={revenueDelta} /></Link>
        <Link to="/orders" className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><StatCard title="Đơn hàng hôm nay" value={String(todayOrders.length)} icon={<TrendingUp className="h-5 w-5" />} sub={`${yesterdayOrders.length} đơn hôm qua`} /></Link>
        <Link to="/inventory?filter=LOW" className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><StatCard title="Sản phẩm hết kho" value={String(lowStock.length)} icon={<Package className="h-5 w-5" />} warning="Cần nhập/kiểm kho" /></Link>
        <Link to="/finance#cong-no" className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><StatCard title="Khách hàng nợ" value={String(debtCustomers.length)} icon={<Users className="h-5 w-5" />} sub={`Tổng nợ: ${money(totalDebt)}`} /></Link>
      </div>

      <div className="mt-4 rounded-[var(--radius-card)] bg-white p-3 shadow-sm ring-1 ring-red-100 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Cảnh báo công nợ</h2>
            <p className="text-sm text-zinc-500">{debtCustomers.length} khách đang nợ, tổng {money(totalDebt)}</p>
          </div>
          <Link to="/finance" className="inline-flex w-full items-center justify-center rounded-[var(--radius-control)] border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 lg:w-auto">
            Xem sổ công nợ
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {topDebtCustomers.map((customer) => (
            <div key={customer.id} className="min-w-0 rounded-[var(--radius-control)] bg-red-50 px-3 py-2 ring-1 ring-red-100">
              <div className="truncate text-sm font-bold text-red-800">{customer.name}</div>
              <div className="text-xs font-semibold text-red-600">{money(customer.oldDebt)}</div>
            </div>
          ))}
          {topDebtCustomers.length === 0 && <div className="rounded-[var(--radius-control)] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">Chưa có công nợ cần cảnh báo.</div>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-zinc-200/70 sm:p-6 lg:col-span-4">
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
                    className="w-full rounded-t bg-emerald-600"
                    style={{ height: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%` }}
                    title={`${day.label}: ${money(day.revenue)}`}
                  />
                </div>
                <div className="text-center text-xs text-zinc-600">{day.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-zinc-200/70 sm:p-6 lg:col-span-3">
          <h2 className="mb-5 text-base font-semibold text-zinc-900">Sản phẩm bán chạy</h2>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="rounded-[var(--radius-control)] border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 break-words font-medium text-zinc-900">{product.name}</div>
                    <div className="text-xs text-zinc-500">Đã bán {product.quantity.toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="max-w-[130px] shrink-0 truncate text-right text-sm font-semibold text-emerald-600">{money(product.revenue)}</div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <div className="rounded-[var(--radius-control)] border border-dashed p-6 text-center text-sm text-zinc-500">Chưa có dữ liệu bán hàng.</div>}
          </div>
        </div>
      </div>

      <Link
        to="/pos"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-4 ring-white transition-transform active:scale-95 hover:bg-emerald-700 lg:bottom-5 lg:z-40"
        title="Bán hàng nhanh"
      >
        <Plus className="h-7 w-7" />
      </Link>
    </div>
  );
}

function StatCard({ title, value, icon, delta, sub, warning }: { title: string; value: string; icon: ReactNode; delta?: number; sub?: string; warning?: string }) {
  const isUp = (delta ?? 0) >= 0;
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-[var(--radius-card)] bg-white p-3 shadow-sm ring-1 ring-zinc-200/70 sm:min-h-[140px] sm:p-5">
      <div className="flex items-center justify-between">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-500 sm:text-sm">{title}</p>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div>
        <p className="truncate text-lg font-semibold tracking-tight text-zinc-900 sm:text-2xl">{value}</p>
        {delta !== undefined ? (
          <p className={`mt-2 flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            {isUp ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
            <span className="truncate">{Math.abs(delta).toFixed(1)}% so với hôm qua</span>
          </p>
        ) : (
          <p className={`mt-2 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${warning ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>{warning ?? sub}</p>
        )}
      </div>
    </div>
  );
}
