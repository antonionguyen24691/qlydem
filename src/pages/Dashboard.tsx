import { CalendarDays, ChartNoAxesCombined, CircleAlert, DollarSign, Package, Plus, ReceiptText, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDataStore } from "../store/data";
import { useThemeStore } from "../store/theme";
import { getAuthHeaders } from "../lib/supabase";

type PromiseSummary = { customer_id: string; promised_amount: number; promised_date: string; status: string };
type CashbookRow = { id: string; account_type: string; direction: string; source_type?: string; amount: number; entry_date?: string; created_at: string };
type DashboardTab = "OVERVIEW" | "SALES" | "INVENTORY" | "CASHFLOW";
type PeriodFilter = "TODAY" | "7_DAYS" | "30_DAYS" | "MONTH" | "CUSTOM";
type DailyPoint = { key: string; label: string; revenue: number; collected: number; expense: number; orders: number };

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "OVERVIEW", label: "Tổng quan" },
  { id: "SALES", label: "Bán hàng" },
  { id: "INVENTORY", label: "Tồn kho" },
  { id: "CASHFLOW", label: "Công nợ & dòng tiền" }
];

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function keyOf(value?: string) {
  return String(value ?? "").slice(0, 10);
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

function addDays(key: string, days: number) {
  const result = dateFromKey(key);
  result.setDate(result.getDate() + days);
  return localDateKey(result);
}

function dateLabel(key: string) {
  return dateFromKey(key).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function periodTitle(period: PeriodFilter, from: string, to: string) {
  if (period === "TODAY") return "Hôm nay";
  if (period === "7_DAYS") return "7 ngày gần đây";
  if (period === "30_DAYS") return "30 ngày gần đây";
  if (period === "MONTH") return "Tháng này";
  return `${from || "…"} đến ${to || "…"}`;
}

export function Dashboard() {
  const themeId = useThemeStore((state) => state.themeId);
  const { orders, products, customers, isLoadingLiveData, liveDataError } = useDataStore();
  const [activeTab, setActiveTab] = useState<DashboardTab>("OVERVIEW");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("TODAY");
  const [dateFrom, setDateFrom] = useState(() => `${localDateKey().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(() => localDateKey());
  const [promises, setPromises] = useState<PromiseSummary[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookRow[]>([]);
  const [hasCashbookAccess, setHasCashbookAccess] = useState(false);

  useEffect(() => {
    // Finance permissions are optional on the operational dashboard.
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const [promiseResponse, cashbookResponse] = await Promise.all([
          fetch("/api/data/payment-promises", { headers }),
          fetch("/api/data/cashbook_entries", { headers })
        ]);
        const [promiseBody, cashbookBody] = await Promise.all([promiseResponse.json(), cashbookResponse.json()]);
        if (promiseResponse.ok && promiseBody.ok) setPromises(promiseBody.rows ?? []);
        if (cashbookResponse.ok && cashbookBody.ok) {
          setCashbookEntries(cashbookBody.rows ?? []);
          setHasCashbookAccess(true);
        }
      } catch {
        setPromises([]);
        setCashbookEntries([]);
      }
    })();
  }, []);

  const today = localDateKey();
  const range = useMemo(() => {
    const currentMonthStart = `${today.slice(0, 8)}01`;
    if (periodFilter === "TODAY") return { from: today, to: today };
    if (periodFilter === "7_DAYS") return { from: addDays(today, -6), to: today };
    if (periodFilter === "30_DAYS") return { from: addDays(today, -29), to: today };
    if (periodFilter === "MONTH") return { from: currentMonthStart, to: today };
    return { from: dateFrom || currentMonthStart, to: dateTo || today };
  }, [dateFrom, dateTo, periodFilter, today]);
  const validRange = range.from <= range.to;
  const inRange = (value?: string) => validRange && keyOf(value) >= range.from && keyOf(value) <= range.to;
  const rangeDays = useMemo(() => {
    if (!validRange) return [];
    const days: string[] = [];
    for (let key = range.from; key <= range.to && days.length < 93; key = addDays(key, 1)) days.push(key);
    return days;
  }, [range.from, range.to, validRange]);

  const periodOrders = useMemo(
    () => orders.filter((order) => order.status !== "Đã hủy" && inRange(order.date)),
    [orders, range.from, range.to, validRange]
  );
  const periodCashbook = useMemo(
    () => cashbookEntries.filter((entry) => inRange(entry.entry_date ?? entry.created_at)),
    [cashbookEntries, range.from, range.to, validRange]
  );
  const dailySeries = useMemo<DailyPoint[]>(() => rangeDays.map((key) => {
    const dayOrders = periodOrders.filter((order) => keyOf(order.date) === key);
    const dayCashbook = periodCashbook.filter((entry) => keyOf(entry.entry_date ?? entry.created_at) === key);
    return {
      key,
      label: dateLabel(key),
      revenue: dayOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
      collected: dayCashbook.filter((entry) => entry.direction === "IN" && ["RECEIPT", "SALES_ORDER"].includes(entry.source_type ?? "")).reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
      expense: dayCashbook.filter((entry) => entry.direction === "OUT" && ["EXPENSE", "SUPPLIER_PAYMENT", "SALES_REFUND"].includes(entry.source_type ?? "")).reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
      orders: dayOrders.length
    };
  }), [periodCashbook, periodOrders, rangeDays]);

  const revenue = periodOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const collected = dailySeries.reduce((sum, day) => sum + day.collected, 0);
  const expense = dailySeries.reduce((sum, day) => sum + day.expense, 0);
  const cogs = periodOrders.reduce((sum, order) => sum + order.items.reduce((itemTotal, item) => itemTotal + Number(item.quantity ?? 0) * Number(item.unitCostSnapshot ?? 0), 0), 0);
  const netProfit = revenue - cogs - expense;
  const debtCustomers = customers.filter((customer) => Number(customer.oldDebt ?? 0) > 0);
  const totalDebt = debtCustomers.reduce((sum, customer) => sum + Number(customer.oldDebt ?? 0), 0);
  const outOfStock = products.filter((product) => Number(product.stock ?? 0) <= 0);
  const nearLowStock = products.filter((product) => Number(product.stock ?? 0) > 0 && Number(product.stock ?? 0) <= Math.max(1, Number(product.minStockLevel ?? 0)));
  const productById = new Map(products.map((product) => [product.id, product]));
  const topProducts = useMemo(() => {
    const sold = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
    for (const order of periodOrders) for (const item of order.items) {
      const current = sold.get(item.id) ?? { id: item.id, name: item.name, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity ?? 0);
      current.revenue += Number(item.total ?? 0);
      sold.set(item.id, current);
    }
    return Array.from(sold.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [periodOrders]);
  const categorySales = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const order of periodOrders) for (const item of order.items) {
      const category = productById.get(item.id)?.category || "Chưa phân loại";
      byCategory.set(category, (byCategory.get(category) ?? 0) + Number(item.total ?? 0));
    }
    return Array.from(byCategory.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [periodOrders, productById]);
  const stockByCategory = useMemo(() => {
    const categories = new Map<string, number>();
    for (const product of products) {
      const category = product.category || "Chưa phân loại";
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    return Array.from(categories.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [products]);
  const overduePromises = promises.filter((promise) => promise.status === "OPEN" && promise.promised_date < today);
  const overduePromiseTotal = overduePromises.reduce((sum, promise) => sum + Number(promise.promised_amount ?? 0), 0);
  const actionItems = [
    ...outOfStock.slice(0, 4).map((product) => ({ id: `out-${product.id}`, level: "danger" as const, title: `${product.name} đã hết kho`, detail: "Cần nhập hàng hoặc kiểm kho", to: "/inventory?filter=LOW" })),
    ...nearLowStock.slice(0, 4).map((product) => ({ id: `low-${product.id}`, level: "warning" as const, title: `${product.name} sắp hết`, detail: `Còn ${Number(product.stock ?? 0).toLocaleString("vi-VN")} ${product.unit || ""}`.trim(), to: "/inventory?filter=LOW" })),
    ...(overduePromises.length ? [{ id: "overdue-promises", level: "danger" as const, title: `${overduePromises.length} hẹn thu đã quá hạn`, detail: money(overduePromiseTotal), to: "/finance#cong-no" }] : []),
    ...(debtCustomers.length ? [{ id: "debts", level: "warning" as const, title: `${debtCustomers.length} khách còn công nợ`, detail: money(totalDebt), to: "/finance#cong-no" }] : [])
  ].slice(0, 6);
  const rangeText = periodTitle(periodFilter, range.from, range.to);

  return (
    <div data-mobile-page="dashboard" data-mobile-theme={themeId} className="mobile-mockup-page mx-auto w-full max-w-[1400px] p-3 pb-24 sm:p-6 lg:p-8">
      <header className="mb-5 flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Trung tâm điều hành</h1>
          <p className="mt-1 text-sm text-zinc-500">Doanh thu, tồn kho, công nợ và dòng tiền trong một nơi.</p>
          {isLoadingLiveData && <p className="mt-2 text-sm font-medium text-emerald-700">Đang đồng bộ dữ liệu...</p>}
          {liveDataError && <p className="mt-2 text-sm font-medium text-red-700">Lỗi dữ liệu: {liveDataError}</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
          <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)} className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 sm:flex-none">
            <option value="TODAY">Hôm nay</option><option value="7_DAYS">7 ngày gần đây</option><option value="30_DAYS">30 ngày gần đây</option><option value="MONTH">Tháng này</option><option value="CUSTOM">Từ ngày đến ngày</option>
          </select></div>
          {periodFilter === "CUSTOM" && <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-xs font-semibold text-zinc-600 sm:flex sm:w-auto"><input aria-label="Từ ngày" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="h-10 min-w-0 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 sm:w-[150px]" /><span>–</span><input aria-label="Đến ngày" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="h-10 min-w-0 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 sm:w-[150px]" /></div>}
        </div>
      </header>

      <nav aria-label="Trang dashboard" className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-1 hide-scrollbar">
        {DASHBOARD_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-selected={activeTab === tab.id} className={`min-w-0 rounded-full px-3 py-2.5 text-sm font-bold transition-colors sm:shrink-0 sm:px-4 ${activeTab === tab.id ? "bg-emerald-700 text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-200 hover:text-emerald-800"}`}>{tab.label}</button>)}
      </nav>

      {!validRange && <div className="mb-4 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</div>}

      {activeTab === "OVERVIEW" && <OverviewTab rangeText={rangeText} revenue={revenue} collected={collected} netProfit={netProfit} orderCount={periodOrders.length} lowStockCount={outOfStock.length + nearLowStock.length} debtTotal={totalDebt} hasCashbookAccess={hasCashbookAccess} dailySeries={dailySeries} actionItems={actionItems} />}
      {activeTab === "SALES" && <SalesTab rangeText={rangeText} dailySeries={dailySeries} topProducts={topProducts} categorySales={categorySales} />}
      {activeTab === "INVENTORY" && <InventoryTab productsTotal={products.length} outOfStock={outOfStock.length} nearLowStock={nearLowStock.length} stockByCategory={stockByCategory} lowProducts={[...outOfStock, ...nearLowStock].slice(0, 8)} />}
      {activeTab === "CASHFLOW" && <CashflowTab rangeText={rangeText} hasCashbookAccess={hasCashbookAccess} dailySeries={dailySeries} totalDebt={totalDebt} debtCustomers={debtCustomers} overduePromises={overduePromises.length} overduePromiseTotal={overduePromiseTotal} />}

      <Link to="/pos" className="fixed bottom-5 right-5 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 ring-4 ring-white transition-transform hover:bg-emerald-800 lg:flex" title="Bán hàng nhanh"><Plus className="h-7 w-7" /></Link>
    </div>
  );
}

function OverviewTab({ rangeText, revenue, collected, netProfit, orderCount, lowStockCount, debtTotal, hasCashbookAccess, dailySeries, actionItems }: { rangeText: string; revenue: number; collected: number; netProfit: number; orderCount: number; lowStockCount: number; debtTotal: number; hasCashbookAccess: boolean; dailySeries: DailyPoint[]; actionItems: ActionItem[] }) {
  return <>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <MetricCard title="Doanh thu" value={money(revenue)} icon={<DollarSign className="h-5 w-5" />} context={rangeText} to="/expenses?tab=REPORT" />
      <MetricCard title="Thực thu" value={hasCashbookAccess ? money(collected) : "—"} icon={<Wallet className="h-5 w-5" />} context={hasCashbookAccess ? "Tiền đã về" : "Cần quyền tài chính"} to="/finance" />
      <MetricCard title="Lợi nhuận ước tính" value={hasCashbookAccess ? money(netProfit) : "—"} icon={<ChartNoAxesCombined className="h-5 w-5" />} context="Doanh thu - giá vốn - chi" to="/expenses?tab=REPORT" />
      <MetricCard title="Đơn hàng" value={String(orderCount)} icon={<ReceiptText className="h-5 w-5" />} context={rangeText} to="/orders" />
      <MetricCard title="Hàng cần xử lý" value={String(lowStockCount)} icon={<Package className="h-5 w-5" />} context="Hết hoặc sắp hết" tone={lowStockCount ? "warning" : undefined} to="/inventory?filter=LOW" />
      <MetricCard title="Công nợ phải thu" value={money(debtTotal)} icon={<Users className="h-5 w-5" />} context="Tổng dư nợ hiện tại" tone={debtTotal ? "danger" : undefined} to="/finance#cong-no" />
    </section>
    <section className="mt-4 grid gap-4 xl:grid-cols-5">
      <RevenueChart className="xl:col-span-3" title="Doanh thu và thực thu" period={rangeText} points={dailySeries} />
      <ActionQueue className="xl:col-span-2" items={actionItems} />
    </section>
  </>;
}

function SalesTab({ rangeText, dailySeries, topProducts, categorySales }: { rangeText: string; dailySeries: DailyPoint[]; topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>; categorySales: Array<{ name: string; value: number }> }) {
  return <div className="grid gap-4 xl:grid-cols-5">
    <RevenueChart className="xl:col-span-3" title="Doanh thu, thực thu và chi phí" period={rangeText} points={dailySeries} includeExpense />
    <RankedBars className="xl:col-span-2" title="Nhóm hàng đóng góp" rows={categorySales} empty="Chưa có doanh thu trong kỳ." to="/products" />
    <ProductRank className="xl:col-span-5" products={topProducts} />
  </div>;
}

function InventoryTab({ productsTotal, outOfStock, nearLowStock, stockByCategory, lowProducts }: { productsTotal: number; outOfStock: number; nearLowStock: number; stockByCategory: Array<{ name: string; value: number }>; lowProducts: Array<any> }) {
  const healthy = Math.max(0, productsTotal - outOfStock - nearLowStock);
  return <div className="grid gap-4 xl:grid-cols-5">
    <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 xl:col-span-2">
      <PanelHeading title="Sức khỏe tồn kho" action="Xem tồn kho" to="/inventory" />
      <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-zinc-100" aria-label={`Tồn kho: ${healthy} ổn định, ${nearLowStock} sắp hết, ${outOfStock} hết hàng`}>
        <Link to="/inventory" className="bg-emerald-600" style={{ width: `${productsTotal ? (healthy / productsTotal) * 100 : 0}%` }} title={`${healthy} mã ổn định`} />
        <Link to="/inventory?filter=LOW" className="bg-amber-500" style={{ width: `${productsTotal ? (nearLowStock / productsTotal) * 100 : 0}%` }} title={`${nearLowStock} mã sắp hết`} />
        <Link to="/inventory?filter=LOW" className="bg-red-600" style={{ width: `${productsTotal ? (outOfStock / productsTotal) * 100 : 0}%` }} title={`${outOfStock} mã hết hàng`} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><InventoryMetric label="Ổn định" value={healthy} tone="text-emerald-700" /><InventoryMetric label="Sắp hết" value={nearLowStock} tone="text-amber-700" /><InventoryMetric label="Hết hàng" value={outOfStock} tone="text-red-700" /></div>
    </section>
    <RankedBars className="xl:col-span-3" title="Số mã theo danh mục" rows={stockByCategory} empty="Chưa có danh mục hàng hóa." to="/inventory" />
    <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 xl:col-span-5"><PanelHeading title="Hàng cần xử lý ngay" action="Mở danh sách tồn kho" to="/inventory?filter=LOW" />
      <div className="mt-3 divide-y divide-zinc-100">{lowProducts.map((product) => <Link key={product.id} to="/inventory?filter=LOW" className="flex items-center justify-between gap-3 py-3 hover:bg-zinc-50"><div className="min-w-0"><p className="truncate font-semibold text-zinc-900">{product.name}</p><p className="text-xs text-zinc-500">Tối thiểu: {Number(product.minStockLevel ?? 0).toLocaleString("vi-VN")}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${Number(product.stock ?? 0) <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{Number(product.stock ?? 0).toLocaleString("vi-VN")} {product.unit || ""}</span></Link>)}{lowProducts.length === 0 && <EmptyState text="Không có mã hàng hết hoặc sắp hết." />}</div>
    </section>
  </div>;
}

function CashflowTab({ rangeText, hasCashbookAccess, dailySeries, totalDebt, debtCustomers, overduePromises, overduePromiseTotal }: { rangeText: string; hasCashbookAccess: boolean; dailySeries: DailyPoint[]; totalDebt: number; debtCustomers: Array<any>; overduePromises: number; overduePromiseTotal: number }) {
  const topDebts = [...debtCustomers].sort((a, b) => Number(b.oldDebt ?? 0) - Number(a.oldDebt ?? 0)).slice(0, 6).map((customer) => ({ name: customer.name, value: Number(customer.oldDebt ?? 0) }));
  return <div className="grid gap-4 xl:grid-cols-5">
    <CashflowChart className="xl:col-span-3" period={rangeText} points={dailySeries} unavailable={!hasCashbookAccess} />
    <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 xl:col-span-2"><PanelHeading title="Rủi ro công nợ" action="Mở công nợ" to="/finance#cong-no" />
      <div className="mt-4 space-y-3"><InfoLine label="Tổng phải thu" value={money(totalDebt)} tone="text-red-700" /><InfoLine label="Khách đang nợ" value={String(debtCustomers.length)} /><InfoLine label="Hẹn thu quá hạn" value={String(overduePromises)} tone={overduePromises ? "text-red-700" : "text-emerald-700"} /><InfoLine label="Tiền hẹn quá hạn" value={money(overduePromiseTotal)} tone={overduePromiseTotal ? "text-red-700" : "text-emerald-700"} /></div>
    </section>
    <RankedBars className="xl:col-span-5" title="Khách có dư nợ cao" rows={topDebts} empty="Chưa có công nợ phải thu." to="/finance#cong-no" />
  </div>;
}

type ActionItem = { id: string; level: "warning" | "danger"; title: string; detail: string; to: string };

function MetricCard({ title, value, icon, context, to, tone }: { title: string; value: string; icon: ReactNode; context: string; to: string; tone?: "warning" | "danger" }) {
  const color = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-zinc-900";
  return <Link to={to} className="group min-h-[126px] rounded-[var(--radius-card)] border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-zinc-500">{title}</p><span className="text-zinc-400 group-hover:text-emerald-700">{icon}</span></div><p className={`mt-4 truncate text-xl font-bold tracking-tight sm:text-2xl ${color}`}>{value}</p><p className="mt-2 truncate text-xs font-medium text-zinc-500">{context}</p></Link>;
}

function PanelHeading({ title, action, to }: { title: string; action?: string; to?: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-zinc-900">{title}</h2>{action && to && <Link to={to} className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-900">{action} →</Link>}</div>;
}

function RevenueChart({ title, period, points, className = "", includeExpense = false }: { title: string; period: string; points: DailyPoint[]; className?: string; includeExpense?: boolean }) {
  const maximum = Math.max(1, ...points.flatMap((point) => includeExpense ? [point.revenue, point.collected, point.expense] : [point.revenue, point.collected]));
  const hasData = points.some((point) => point.revenue > 0 || point.collected > 0 || point.expense > 0);
  return <section className={`min-w-0 rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><PanelHeading title={title} action="Xem báo cáo" to="/expenses?tab=REPORT" /><p className="mt-1 truncate text-xs text-zinc-500">{period} · Bấm cột để xem đơn hàng ngày đó.</p>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold"><Legend color="bg-emerald-600" label="Doanh thu" /><Legend color="bg-blue-600" label="Thực thu" />{includeExpense && <Legend color="bg-red-500" label="Chi phí" />}</div>
    {!hasData ? <EmptyState text="Chưa có số liệu bán hàng trong kỳ này." /> : <div className="mt-5 flex h-40 min-w-0 items-end gap-px border-b border-l border-zinc-200 px-1 pb-5 sm:h-56 sm:gap-2 sm:px-2">{points.map((point, index) => {
      const showLabel = points.length <= 7 || index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
      return <Link key={point.key} to={`/orders?date=${point.key}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" title={`${point.label}: doanh thu ${money(point.revenue)}, thực thu ${money(point.collected)}${includeExpense ? `, chi phí ${money(point.expense)}` : ""}`}><div className="flex flex-1 items-end justify-center gap-px sm:gap-0.5"><span className="min-w-px flex-1 rounded-t bg-emerald-600 transition-opacity group-hover:opacity-75" style={{ height: `${Math.max(point.revenue ? 5 : 0, (point.revenue / maximum) * 100)}%` }} /><span className="min-w-px flex-1 rounded-t bg-blue-600 transition-opacity group-hover:opacity-75" style={{ height: `${Math.max(point.collected ? 5 : 0, (point.collected / maximum) * 100)}%` }} />{includeExpense && <span className="min-w-px flex-1 rounded-t bg-red-500 transition-opacity group-hover:opacity-75" style={{ height: `${Math.max(point.expense ? 5 : 0, (point.expense / maximum) * 100)}%` }} />}</div><span className="h-3 text-center text-[9px] font-medium text-zinc-500 sm:text-[10px]">{showLabel ? point.label : ""}</span></Link>;
    })}</div>}
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><InfoLine label="Doanh thu" value={money(points.reduce((sum, point) => sum + point.revenue, 0))} tone="text-emerald-700" /><InfoLine label="Thực thu" value={money(points.reduce((sum, point) => sum + point.collected, 0))} tone="text-blue-700" /><InfoLine label="Số đơn" value={String(points.reduce((sum, point) => sum + point.orders, 0))} /></div>
  </section>;
}

function CashflowChart({ period, points, className = "", unavailable }: { period: string; points: DailyPoint[]; className?: string; unavailable: boolean }) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.collected, point.expense]));
  const hasData = points.some((point) => point.collected > 0 || point.expense > 0);
  return <section className={`min-w-0 rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><PanelHeading title="Dòng tiền vào và chi ra" action="Mở sổ quỹ" to="/finance" /><p className="mt-1 line-clamp-2 text-xs text-zinc-500">{period} · Tiền vào là thực thu; tiền ra gồm chi phí vận hành và thanh toán nhà cung cấp.</p>{unavailable ? <div className="mt-6 rounded-[var(--radius-control)] border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">Bạn chưa có quyền xem sổ quỹ.</div> : !hasData ? <EmptyState text="Chưa có dòng tiền trong kỳ này." /> : <><div className="mt-4 flex gap-4 text-xs font-semibold"><Legend color="bg-blue-600" label="Tiền vào" /><Legend color="bg-red-500" label="Tiền ra" /></div><div className="mt-5 flex h-40 min-w-0 items-end gap-px border-b border-l border-zinc-200 px-1 pb-5 sm:h-56 sm:gap-2 sm:px-2">{points.map((point, index) => {
    const showLabel = points.length <= 7 || index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
    return <Link key={point.key} to="/finance" className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={`${point.label}: vào ${money(point.collected)}, ra ${money(point.expense)}`}><div className="flex flex-1 items-end justify-center gap-px sm:gap-1"><span className="min-w-px flex-1 rounded-t bg-blue-600 group-hover:opacity-75" style={{ height: `${Math.max(point.collected ? 5 : 0, (point.collected / maximum) * 100)}%` }} /><span className="min-w-px flex-1 rounded-t bg-red-500 group-hover:opacity-75" style={{ height: `${Math.max(point.expense ? 5 : 0, (point.expense / maximum) * 100)}%` }} /></div><span className="h-3 text-center text-[9px] text-zinc-500 sm:text-[10px]">{showLabel ? point.label : ""}</span></Link>;
  })}</div></>}</section>;
}

function RankedBars({ title, rows, empty, to, className = "" }: { title: string; rows: Array<{ name: string; value: number }>; empty: string; to: string; className?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className={`rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><PanelHeading title={title} action="Xem chi tiết" to={to} /><div className="mt-4 space-y-3">{rows.map((row) => <Link key={row.name} to={to} className="block rounded-[var(--radius-control)] p-2 hover:bg-zinc-50"><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-zinc-700">{row.name}</span><span className="shrink-0 font-black text-zinc-900">{row.value.toLocaleString("vi-VN")}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${(row.value / max) * 100}%` }} /></div></Link>)}{rows.length === 0 && <EmptyState text={empty} />}</div></section>;
}

function ProductRank({ products, className = "" }: { products: Array<{ id: string; name: string; quantity: number; revenue: number }>; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><PanelHeading title="Hàng hóa bán chạy" action="Mở danh mục hàng hóa" to="/products" /><div className="mt-3 divide-y divide-zinc-100">{products.map((product, index) => <Link key={product.id} to={`/products?product=${encodeURIComponent(product.id)}`} className="flex items-center gap-3 py-3 hover:bg-zinc-50"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-zinc-900">{product.name}</p><p className="text-xs text-zinc-500">Đã bán {product.quantity.toLocaleString("vi-VN")}</p></div><span className="shrink-0 text-sm font-black text-emerald-700">{money(product.revenue)}</span></Link>)}{products.length === 0 && <EmptyState text="Chưa có hàng hóa bán ra trong kỳ." />}</div></section>;
}

function ActionQueue({ items, className = "" }: { items: ActionItem[]; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><PanelHeading title="Việc cần xử lý" action="Mở vận hành" to="/settings/operations" /><p className="mt-1 text-xs text-zinc-500">Ưu tiên các việc làm giảm rủi ro tiền và hàng.</p><div className="mt-4 divide-y divide-zinc-100">{items.map((item) => <Link key={item.id} to={item.to} className="flex items-start gap-3 py-3 hover:bg-zinc-50"><CircleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${item.level === "danger" ? "text-red-600" : "text-amber-600"}`} /><div className="min-w-0"><p className="font-semibold text-zinc-900">{item.title}</p><p className="mt-0.5 text-xs text-zinc-500">{item.detail}</p></div></Link>)}{items.length === 0 && <EmptyState text="Không có việc khẩn cần xử lý." />}</div></section>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5 text-zinc-600"><i className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>; }
function InfoLine({ label, value, tone = "text-zinc-900" }: { label: string; value: string; tone?: string }) { return <div className="flex items-center justify-between gap-2"><span className="truncate text-zinc-500">{label}</span><span className={`shrink-0 font-black tabular-nums ${tone}`}>{value}</span></div>; }
function InventoryMetric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div><p className={`text-2xl font-black ${tone}`}>{value.toLocaleString("vi-VN")}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p></div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 px-4 py-7 text-center text-sm font-medium text-zinc-500">{text}</div>; }
