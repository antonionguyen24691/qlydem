import React, { useEffect, useMemo, useState } from "react";
import { useDataStore } from "../store/data";
import { Coins, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/auth";
import { isAdmin } from "../lib/permissions";
import { getAuthHeaders } from "../lib/supabase";

type CashbookRow = {
  id: string;
  code?: string;
  account_type: string;
  direction: string;
  source_type?: string;
  amount: number;
  payment_method: string;
  note?: string;
  category?: string;
  person?: string;
  entry_date?: string;
  created_at: string;
};

type ExpenseCategory = { code: string; name: string };

type PeriodFilter = "MONTH" | "LAST_MONTH" | "30_DAYS" | "ALL";

const defaultCategories: ExpenseCategory[] = [
  { code: "FUEL", name: "Xăng xe" },
  { code: "TRANSPORT", name: "Vận tải" },
  { code: "LABOR", name: "Nhân công" },
  { code: "UTILITY", name: "Điện nước" },
  { code: "RENT", name: "Thuê mặt bằng" },
  { code: "OTHER", name: "Chi phí khác" }
];

function entryDateOf(entry: CashbookRow) {
  return entry.entry_date ?? entry.created_at;
}

export function Expenses() {
  const { orders, products, loadLiveData } = useDataStore();
  const user = useAuthStore((state) => state.user);
  const canManageCategories = isAdmin(user);

  const [tab, setTab] = useState<"EXPENSES" | "REPORT">("EXPENSES");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("MONTH");
  const [cashbookEntries, setCashbookEntries] = useState<CashbookRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>(defaultCategories);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    category: "",
    customCategory: "",
    amount: "" as number | "",
    accountType: "CASH" as "CASH" | "BANK",
    entryDate: new Date().toISOString().slice(0, 10),
    person: "",
    note: ""
  });
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategories, setIsSavingCategories] = useState(false);

  const loadRows = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/data/cashbook_entries", { headers });
      const body = await response.json();
      if (response.ok && body.ok) setCashbookEntries(body.rows ?? []);
    } catch {
      setCashbookEntries([]);
    }
  };

  useEffect(() => {
    void loadRows();
    void (async () => {
      try {
        const response = await fetch("/api/settings?key=expenseCategories", { headers: await getAuthHeaders() });
        const body = await response.json();
        const rows = body?.expenseCategories?.categories;
        if (Array.isArray(rows) && rows.length > 0) setCategories(rows);
      } catch {
        setCategories(defaultCategories);
      }
    })();
  }, []);

  const isInPeriod = (value: string) => {
    if (periodFilter === "ALL") return true;
    const date = new Date(value);
    const now = new Date();
    if (periodFilter === "MONTH") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (periodFilter === "LAST_MONTH") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getFullYear() === lastMonth.getFullYear() && date.getMonth() === lastMonth.getMonth();
    }
    return date.getTime() >= now.getTime() - 30 * 86400000;
  };

  const expenseEntries = useMemo(
    () => cashbookEntries.filter((entry) => entry.direction === "OUT" && entry.source_type === "EXPENSE"),
    [cashbookEntries]
  );
  const periodExpenses = expenseEntries.filter((entry) => isInPeriod(entryDateOf(entry)));
  const filteredExpenses = periodExpenses.filter((entry) => categoryFilter === "all" || (entry.category ?? "Chi phí khác") === categoryFilter);
  const periodExpenseTotal = periodExpenses.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const periodExpenseCash = periodExpenses.filter((entry) => entry.account_type === "CASH").reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const periodExpenseBank = periodExpenseTotal - periodExpenseCash;

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const entry of periodExpenses) {
      const key = entry.category ?? "Chi phí khác";
      const current = map.get(key) ?? { total: 0, count: 0 };
      map.set(key, { total: current.total + Number(entry.amount ?? 0), count: current.count + 1 });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [periodExpenses]);

  // ===== Báo cáo doanh thu - chi phí =====
  const periodOrders = orders.filter((order) => isInPeriod(order.date));
  const periodRevenue = periodOrders.reduce((sum, order) => sum + order.total, 0);
  const periodCollected = cashbookEntries
    .filter((entry) => entry.direction === "IN" && isInPeriod(entryDateOf(entry)) && ["RECEIPT", "SALES_ORDER"].includes(entry.source_type ?? ""))
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const costByProduct = useMemo(() => new Map(products.map((product) => [product.id, product.cost])), [products]);
  // Giá vốn ước tính theo giá vốn hiện tại của từng mã hàng (chưa phải giá vốn tại thời điểm bán).
  const periodCogs = periodOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * (costByProduct.get(item.id) ?? 0), 0),
    0
  );
  const grossProfit = periodRevenue - periodCogs;
  const netProfit = grossProfit - periodExpenseTotal;
  const periodWithdrawals = cashbookEntries
    .filter((entry) => entry.direction === "OUT" && entry.source_type === "FUND_WITHDRAWAL" && isInPeriod(entryDateOf(entry)))
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const periodSupplierPayments = cashbookEntries
    .filter((entry) => entry.direction === "OUT" && entry.source_type === "SUPPLIER_PAYMENT" && isInPeriod(entryDateOf(entry)))
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

  const dailyReport = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number; collected: number; expense: number }>();
    const ensure = (day: string) => {
      const current = map.get(day) ?? { revenue: 0, orders: 0, collected: 0, expense: 0 };
      map.set(day, current);
      return current;
    };
    for (const order of periodOrders) {
      const day = order.date.slice(0, 10);
      const row = ensure(day);
      row.revenue += order.total;
      row.orders += 1;
    }
    for (const entry of cashbookEntries) {
      const day = String(entryDateOf(entry)).slice(0, 10);
      if (!isInPeriod(entryDateOf(entry))) continue;
      if (entry.direction === "IN" && ["RECEIPT", "SALES_ORDER"].includes(entry.source_type ?? "")) ensure(day).collected += Number(entry.amount ?? 0);
      if (entry.direction === "OUT" && entry.source_type === "EXPENSE") ensure(day).expense += Number(entry.amount ?? 0);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOrders, cashbookEntries, periodFilter]);

  const openDialog = () => {
    setForm({
      category: categories[0]?.name ?? "",
      customCategory: "",
      amount: "",
      accountType: "CASH",
      entryDate: new Date().toISOString().slice(0, 10),
      person: "",
      note: ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const category = form.category === "__CUSTOM__" ? form.customCategory.trim() : form.category;
    const amount = Number(form.amount);
    if (!category) {
      alert("Vui lòng chọn hoặc nhập loại chi phí.");
      return;
    }
    if (amount <= 0) {
      alert("Số tiền chi phải lớn hơn 0.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/data/cashbook-transactions", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({
          action: "EXPENSE",
          amount,
          category,
          accountType: form.accountType,
          entryDate: form.entryDate,
          person: form.person.trim() || undefined,
          note: form.note.trim() || undefined
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không ghi được chi phí.");
      await loadRows();
      setIsDialogOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không ghi được chi phí.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategories = async (nextCategories: ExpenseCategory[]) => {
    setIsSavingCategories(true);
    try {
      const response = await fetch("/api/settings?key=expenseCategories", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ categories: nextCategories })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được loại chi phí.");
      setCategories(body.expenseCategories?.categories ?? nextCategories);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được loại chi phí.");
    } finally {
      setIsSavingCategories(false);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const code = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toUpperCase() || `CAT_${Date.now()}`;
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      alert("Loại chi phí này đã tồn tại.");
      return;
    }
    await saveCategories([...categories, { code, name }]);
    setNewCategoryName("");
  };

  const removeCategory = async (code: string) => {
    if (categories.length <= 1) {
      alert("Phải giữ ít nhất một loại chi phí.");
      return;
    }
    await saveCategories(categories.filter((category) => category.code !== code));
  };

  const periodLabel = periodFilter === "MONTH" ? "tháng này" : periodFilter === "LAST_MONTH" ? "tháng trước" : periodFilter === "30_DAYS" ? "30 ngày" : "toàn bộ";

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Chi phí &amp; Báo cáo</h1>
          <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
            <option value="MONTH">Tháng này</option>
            <option value="LAST_MONTH">Tháng trước</option>
            <option value="30_DAYS">30 ngày gần đây</option>
            <option value="ALL">Tất cả thời gian</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" onClick={() => { void loadRows(); void loadLiveData(); }}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Tải lại</span>
          </Button>
          <Button onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm chi phí
          </Button>
        </div>
      </div>

      <div className="border-b border-zinc-200 bg-white px-4 sm:px-6">
        <div className="flex gap-1">
          {[
            ["EXPENSES", "Chi phí"],
            ["REPORT", "Báo cáo doanh thu - chi phí"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as "EXPENSES" | "REPORT")}
              className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar space-y-4">
        {tab === "EXPENSES" ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard icon={<Coins className="h-4 w-4" />} label={`Tổng chi phí ${periodLabel}`} value={`${periodExpenseTotal.toLocaleString()} ₫`} tone="red" />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Chi bằng tiền mặt" value={`${periodExpenseCash.toLocaleString()} ₫`} tone="dark" />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Chi qua ngân hàng" value={`${periodExpenseBank.toLocaleString()} ₫`} tone="dark" />
              <StatCard icon={<Coins className="h-4 w-4" />} label="Số phiếu chi" value={String(periodExpenses.length)} tone="dark" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-bold text-zinc-900">Danh sách chi phí ({periodLabel})</h2>
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
                    <option value="all">Tất cả loại chi phí</option>
                    {expenseByCategory.map(([category]) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="divide-y divide-zinc-100">
                  {filteredExpenses.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-zinc-900">{entry.category ?? "Chi phí khác"}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${entry.account_type === "BANK" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {entry.account_type === "BANK" ? "Ngân hàng" : "Tiền mặt"}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">
                          {new Date(entryDateOf(entry)).toLocaleDateString("vi-VN")}
                          {entry.person ? ` · ${entry.person}` : ""}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 font-black tabular-nums text-red-600">-{Number(entry.amount ?? 0).toLocaleString()} ₫</div>
                    </div>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <div className="py-12 text-center text-sm text-zinc-500">Chưa có chi phí nào trong kỳ. Bấm "Thêm chi phí" để ghi nhận.</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 font-bold text-zinc-900">Chi phí theo loại</h2>
                  <div className="space-y-2">
                    {expenseByCategory.map(([category, summary]) => (
                      <div key={category} className="rounded-lg bg-zinc-50 px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-zinc-900">{category}</span>
                          <span className="font-black tabular-nums text-red-600">{summary.total.toLocaleString()} ₫</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${periodExpenseTotal > 0 ? Math.round((summary.total / periodExpenseTotal) * 100) : 0}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{summary.count} phiếu · {periodExpenseTotal > 0 ? Math.round((summary.total / periodExpenseTotal) * 100) : 0}%</div>
                      </div>
                    ))}
                    {expenseByCategory.length === 0 && <div className="py-6 text-center text-sm text-zinc-500">Chưa có dữ liệu.</div>}
                  </div>
                </div>

                {canManageCategories && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <button type="button" className="flex w-full items-center justify-between font-bold text-zinc-900" onClick={() => setIsCategoryManagerOpen((current) => !current)}>
                      Loại chi phí
                      <span className="text-sm font-semibold text-emerald-700">{isCategoryManagerOpen ? "Thu gọn" : "Quản lý"}</span>
                    </button>
                    {isCategoryManagerOpen && (
                      <div className="mt-3 space-y-2">
                        {categories.map((category) => (
                          <div key={category.code} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                            <span className="font-semibold text-zinc-900">{category.name}</span>
                            <button type="button" onClick={() => removeCategory(category.code)} disabled={isSavingCategories} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label={`Xóa ${category.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Loại chi phí mới..." />
                          <Button type="button" onClick={addCategory} disabled={isSavingCategories}>Thêm</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label={`Doanh thu ${periodLabel}`} value={`${periodRevenue.toLocaleString()} ₫`} tone="green" />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Thực thu (tiền về)" value={`${periodCollected.toLocaleString()} ₫`} tone="green" />
              <StatCard icon={<TrendingDown className="h-4 w-4" />} label="Giá vốn ước tính" value={`${periodCogs.toLocaleString()} ₫`} tone="dark" />
              <StatCard icon={<Coins className="h-4 w-4" />} label="Chi phí vận hành" value={`${periodExpenseTotal.toLocaleString()} ₫`} tone="red" />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Lợi nhuận ròng ước tính" value={`${netProfit.toLocaleString()} ₫`} tone={netProfit >= 0 ? "green" : "red"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-200 p-4">
                  <h2 className="font-bold text-zinc-900">Chi tiết theo ngày ({periodLabel})</h2>
                  <p className="mt-1 text-sm text-zinc-500">Doanh thu theo đơn hàng, thực thu và chi phí ghi nhận từng ngày.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Ngày</th>
                        <th className="px-4 py-3 text-right">Số đơn</th>
                        <th className="px-4 py-3 text-right">Doanh thu</th>
                        <th className="px-4 py-3 text-right">Thực thu</th>
                        <th className="px-4 py-3 text-right">Chi phí</th>
                        <th className="px-4 py-3 text-right">DT - CP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dailyReport.map(([day, row]) => (
                        <tr key={day} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-semibold text-zinc-900">{new Date(day).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right text-zinc-600">{row.orders}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">{row.revenue.toLocaleString()} ₫</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{row.collected.toLocaleString()} ₫</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600">{row.expense.toLocaleString()} ₫</td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.revenue - row.expense >= 0 ? "text-zinc-900" : "text-red-600"}`}>{(row.revenue - row.expense).toLocaleString()} ₫</td>
                        </tr>
                      ))}
                      {dailyReport.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Chưa có dữ liệu trong kỳ.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 font-bold text-zinc-900">Kết quả kinh doanh ({periodLabel})</h2>
                  <div className="space-y-2 text-sm">
                    <ReportRow label="Doanh thu bán hàng" value={periodRevenue} />
                    <ReportRow label="Giá vốn ước tính" value={-periodCogs} />
                    <ReportRow label="Lợi nhuận gộp" value={grossProfit} bold />
                    <ReportRow label="Chi phí vận hành" value={-periodExpenseTotal} />
                    <div className="border-t border-dashed border-zinc-200 pt-2">
                      <ReportRow label="Lợi nhuận ròng ước tính" value={netProfit} bold highlight />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-400">Giá vốn tính theo giá vốn hiện tại của từng mã hàng (bình quân gia quyền), chỉ mang tính ước tính.</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 font-bold text-zinc-900">Chi phí theo loại</h2>
                  <div className="space-y-2 text-sm">
                    {expenseByCategory.map(([category, summary]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-zinc-600">{category}</span>
                        <span className="font-bold tabular-nums text-red-600">{summary.total.toLocaleString()} ₫</span>
                      </div>
                    ))}
                    {expenseByCategory.length === 0 && <div className="py-4 text-center text-zinc-500">Chưa có chi phí.</div>}
                    <div className="space-y-2 border-t border-zinc-100 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600">Trả nhà cung cấp</span>
                        <span className="font-bold tabular-nums text-zinc-900">{periodSupplierPayments.toLocaleString()} ₫</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600">Rút quỹ sử dụng</span>
                        <span className="font-bold tabular-nums text-zinc-900">{periodWithdrawals.toLocaleString()} ₫</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Thêm chi phí">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="flex-1 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Loại chi phí (*)</label>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[16px] sm:h-10 sm:text-sm"
              >
                {categories.map((category) => (
                  <option key={category.code} value={category.name}>{category.name}</option>
                ))}
                <option value="__CUSTOM__">Khác (nhập tay)...</option>
              </select>
              {form.category === "__CUSTOM__" && (
                <Input
                  value={form.customCategory}
                  onChange={(event) => setForm({ ...form, customCategory: event.target.value })}
                  placeholder="VD: Sửa xe tải, tiếp khách..."
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Số tiền (*)</label>
              <Input
                type="number"
                min={1000}
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: Number(event.target.value) || "" })}
                placeholder="0"
                className="text-lg font-bold text-red-600"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-700">Nguồn chi</label>
                <select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value as "CASH" | "BANK" })} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[16px] sm:h-10 sm:text-sm">
                  <option value="CASH">Quỹ tiền mặt</option>
                  <option value="BANK">Tài khoản ngân hàng</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-700">Ngày chi</label>
                <Input type="date" value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Người chi / người nhận</label>
              <Input value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value })} placeholder="VD: Anh Nam - tài xế" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Ghi chú</label>
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={2} placeholder="VD: Đổ dầu xe tải chở hàng đi Buôn Hồ..." className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>
          <div className="mt-8 flex gap-3 border-t border-zinc-100 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>{isSaving ? "Đang ghi..." : "Ghi chi phí"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "green" | "red" | "dark" }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm sm:p-4">
      <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="line-clamp-2">{label}</span>
      </div>
      <div className={`truncate text-lg font-bold tabular-nums sm:text-2xl ${tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

function ReportRow({ label, value, bold = false, highlight = false }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? "font-bold text-zinc-900" : "text-zinc-600"}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-black" : "font-semibold"} ${highlight ? (value >= 0 ? "text-emerald-700" : "text-red-600") : value < 0 ? "text-red-600" : "text-zinc-900"}`}>
        {value < 0 ? "-" : ""}{Math.abs(value).toLocaleString()} ₫
      </span>
    </div>
  );
}
