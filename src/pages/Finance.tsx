import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDataStore, Customer } from "../store/data";
import { ArrowLeftRight, Bell, DollarSign, Wallet, FileText, Search, Plus, UserCircle, AlertCircle, TrendingUp, Landmark } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";
import { isAdmin } from "../lib/permissions";
import { getAuthHeaders } from "../lib/supabase";

type ReceiptRow = {
  id: string;
  code: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  receipt_date: string;
  note?: string;
};

type SupplierFinanceRow = { id: string; name: string; current_payable?: number };
type CashbookRow = { id: string; code?: string; account_type: string; direction: string; source_type?: string; amount: number; payment_method: string; note?: string; category?: string; person?: string; created_at: string };

type FundAction = "TRANSFER" | "WITHDRAW" | "ADJUST";

const CASHBOOK_SOURCE_LABEL: Record<string, string> = {
  RECEIPT: "Thu nợ khách",
  SALES_ORDER: "Bán hàng",
  SUPPLIER_PAYMENT: "Trả nhà cung cấp",
  FUND_TRANSFER: "Chuyển quỹ",
  FUND_WITHDRAWAL: "Rút quỹ",
  FUND_ADJUSTMENT: "Điều chỉnh quỹ",
  EXPENSE: "Chi phí"
};
type OrderDebtRow = { id: string; order_id: string; customer_id: string; remaining_amount: number; due_date?: string; status: string };
type PromiseRow = { id: string; customer_id: string; promised_amount: number; promised_date: string; status: string; contact_name?: string; note?: string; created_at: string };

type AgingFilter = "all" | "0-7" | "8-15" | "16-30" | "30+";
type PeriodFilter = "MONTH" | "30_DAYS" | "ALL";

export function Finance() {
  const themeId = useThemeStore((state) => state.themeId);
  const location = useLocation();
  const { customers, orders, loadLiveData } = useDataStore();
  const { isAuthenticated, user } = useAuthStore();
  const canAdjustFund = isAdmin(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedCustomerForReceipt, setSelectedCustomerForReceipt] = useState("");
  const [receiptAmount, setReceiptAmount] = useState<number | ''>('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState("CASH");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptAllocations, setReceiptAllocations] = useState<Record<string, number>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierFinanceRow[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookRow[]>([]);
  const [orderDebts, setOrderDebts] = useState<OrderDebtRow[]>([]);
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("MONTH");
  const [debtPage, setDebtPage] = useState(1);
  const [debtPageSize, setDebtPageSize] = useState(20);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [fundAction, setFundAction] = useState<FundAction>("TRANSFER");
  const [fundAmount, setFundAmount] = useState<number | "">("");
  const [fundFrom, setFundFrom] = useState<"CASH" | "BANK">("CASH");
  const [fundAccount, setFundAccount] = useState<"CASH" | "BANK">("CASH");
  const [fundDirection, setFundDirection] = useState<"IN" | "OUT">("IN");
  const [fundPurpose, setFundPurpose] = useState("");
  const [fundPerson, setFundPerson] = useState("");
  const [fundNote, setFundNote] = useState("");
  const [isSavingFund, setIsSavingFund] = useState(false);
  const [promises, setPromises] = useState<PromiseRow[]>([]);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<"INCREASE" | "DECREASE">("DECREASE");
  const [adjustAmount, setAdjustAmount] = useState<number | "">("");
  const [adjustNote, setAdjustNote] = useState("");
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);
  const [isPromiseOpen, setIsPromiseOpen] = useState(false);
  const [promiseAmount, setPromiseAmount] = useState<number | "">("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseContact, setPromiseContact] = useState("");
  const [promiseNote, setPromiseNote] = useState("");
  const [isSavingPromise, setIsSavingPromise] = useState(false);

  useEffect(() => {
    if (location.hash !== "#cong-no") return;
    window.setTimeout(() => document.getElementById("cong-no")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [location.hash]);

  const loadFinanceRows = async () => {
    try {
      const headers = await getAuthHeaders();
      const [receiptResponse, supplierResponse, cashbookResponse, debtResponse, promiseResponse] = await Promise.all([
        fetch("/api/data/receipts", { headers }),
        fetch("/api/data/suppliers", { headers }),
        fetch("/api/data/cashbook_entries", { headers }),
        fetch("/api/data/order_debts", { headers }),
        fetch("/api/data/payment-promises", { headers })
      ]);
      const [receiptBody, supplierBody, cashbookBody, debtBody, promiseBody] = await Promise.all([
        receiptResponse.json(), supplierResponse.json(), cashbookResponse.json(), debtResponse.json(), promiseResponse.json()
      ]);
      if (receiptResponse.ok && receiptBody.ok) setReceipts(receiptBody.rows ?? []);
      if (supplierResponse.ok && supplierBody.ok) setSuppliers(supplierBody.rows ?? []);
      if (cashbookResponse.ok && cashbookBody.ok) setCashbookEntries(cashbookBody.rows ?? []);
      if (debtResponse.ok && debtBody.ok) setOrderDebts(debtBody.rows ?? []);
      if (promiseResponse.ok && promiseBody.ok) setPromises(promiseBody.rows ?? []);
    } catch {
      setReceipts([]);
      setSuppliers([]);
      setCashbookEntries([]);
      setOrderDebts([]);
      setPromises([]);
    }
  };

  useEffect(() => {
    loadFinanceRows();
  }, []);

  const isInPeriod = (value: string) => {
    if (periodFilter === "ALL") return true;
    const date = new Date(value);
    const now = new Date();
    if (periodFilter === "MONTH") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return date.getTime() >= now.getTime() - (30 * 86400000);
  };
  const periodOrders = orders.filter((order) => order.status !== "Đã hủy" && isInPeriod(order.date));
  const periodReceipts = receipts.filter((receipt) => isInPeriod(receipt.receipt_date));
  const periodCashbook = cashbookEntries.filter((entry) => isInPeriod(entry.created_at));
  const totalReceivables = customers.reduce((acc, c) => acc + c.oldDebt, 0);
  const totalPayables = suppliers.reduce((acc, supplier) => acc + Number(supplier.current_payable ?? 0), 0);
  const periodRevenue = periodOrders.reduce((sum, order) => sum + order.total, 0);
  const periodCollected = periodCashbook.filter((entry) => entry.direction === "IN" && ["RECEIPT", "SALES_ORDER"].includes(entry.source_type ?? "")).reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const periodExpense = periodCashbook.filter((entry) => entry.direction === "OUT" && ["EXPENSE", "SUPPLIER_PAYMENT", "SALES_REFUND"].includes(entry.source_type ?? "")).reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const balanceFor = (accountType: string) => cashbookEntries.filter((entry) => entry.account_type === accountType).reduce((sum, entry) => sum + (entry.direction === "OUT" ? -1 : 1) * Number(entry.amount ?? 0), 0);
  const cashBalance = balanceFor("CASH");
  const bankBalance = balanceFor("BANK");
  const openDebtOrders = orders.filter((order) => order.total > order.paid);
  const debtAgeByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    const today = new Date();
    for (const debt of orderDebts.filter((item) => Number(item.remaining_amount) > 0)) {
      const order = orders.find((item) => item.dbId === debt.order_id);
      const anchor = debt.due_date ?? order?.date;
      if (!anchor) continue;
      const age = Math.max(0, Math.floor((today.getTime() - new Date(anchor).getTime()) / 86400000));
      map.set(debt.customer_id, Math.max(map.get(debt.customer_id) ?? 0, age));
    }
    for (const order of openDebtOrders.filter((item) => item.customerId && !map.has(item.customerId))) {
      const age = Math.max(0, Math.floor((today.getTime() - new Date(order.date).getTime()) / 86400000));
      map.set(order.customerId!, age);
    }
    return map;
  }, [openDebtOrders, orderDebts, orders]);
  const debtReminders = customers
    .filter((customer) => customer.oldDebt > 0)
    .sort((a, b) => b.oldDebt - a.oldDebt)
    .slice(0, 8)
    .map((customer) => ({
      customer,
      orders: orders.filter((order) => order.customerId === customer.id && order.total > order.paid),
      priority: customer.oldDebt > customer.creditLimit && customer.creditLimit > 0 ? "Vượt hạn mức" : "Cần nhắc"
    }));

  const filteredCustomers = customers.filter(c => {
    if (c.oldDebt <= 0) return false;
    const age = debtAgeByCustomer.get(c.id) ?? 0;
    const matchAging =
      agingFilter === "all" ||
      (agingFilter === "0-7" && c.oldDebt > 0 && age <= 7) ||
      (agingFilter === "8-15" && age >= 8 && age <= 15) ||
      (agingFilter === "16-30" && age >= 16 && age <= 30) ||
      (agingFilter === "30+" && age > 30);
    return matchAging && (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  });
  const debtTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / debtPageSize));
  const pagedCustomers = filteredCustomers.slice((debtPage - 1) * debtPageSize, debtPage * debtPageSize);

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
      .filter((order) => order.customerId === selectedCustomer.id || order.customerName === selectedCustomer.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, selectedCustomer]);

  const selectedCustomerReceipts = useMemo(() => {
    if (!selectedCustomer) return [];
    return receipts
      .filter((receipt) => receipt.customer_id === selectedCustomer.id)
      .sort((a, b) => new Date(b.receipt_date).getTime() - new Date(a.receipt_date).getTime());
  }, [receipts, selectedCustomer]);

  const selectedDebtOrders = selectedCustomerOrders.filter((order) => order.total > order.paid);
  const selectedCustomerDebtRows = orderDebts.filter((debt) => debt.customer_id === selectedCustomerForReceipt && Number(debt.remaining_amount) > 0 && ["OPEN", "PARTIAL"].includes(debt.status));
  const allocatedReceiptAmount = Object.values(receiptAllocations).reduce<number>((sum, amount) => sum + Number(amount || 0), 0);
  const selectedTotalSales = selectedCustomerOrders.reduce((sum, order) => sum + order.total, 0);
  const selectedTotalPaid = selectedCustomerOrders.reduce((sum, order) => sum + order.paid, 0);
  const selectedOldestDebtAge = selectedCustomer ? debtAgeByCustomer.get(selectedCustomer.id) ?? 0 : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedCustomerPromises = useMemo(() => {
    if (!selectedCustomer) return [];
    return promises
      .filter((promise) => promise.customer_id === selectedCustomer.id)
      .sort((a, b) => (a.status === "OPEN" ? -1 : 1) - (b.status === "OPEN" ? -1 : 1) || a.promised_date.localeCompare(b.promised_date));
  }, [promises, selectedCustomer]);
  const overduePromiseCustomerIds = useMemo(() => {
    const set = new Set<string>();
    for (const promise of promises) {
      if (promise.status === "OPEN" && promise.promised_date < todayIso) set.add(promise.customer_id);
    }
    return set;
  }, [promises, todayIso]);

  const openFundDialog = (action: FundAction) => {
    setFundAction(action);
    setFundAmount("");
    setFundFrom("CASH");
    setFundAccount("CASH");
    setFundDirection("IN");
    setFundPurpose("");
    setFundPerson("");
    setFundNote("");
    setIsFundOpen(true);
  };

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(fundAmount);
    if (amount <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ.");
      return;
    }
    if (fundAction === "WITHDRAW" && (!fundPurpose.trim() || !fundPerson.trim())) {
      alert("Rút quỹ phải ghi rõ mục đích rút và người rút.");
      return;
    }
    setIsSavingFund(true);
    try {
      const payload: Record<string, unknown> = { action: fundAction, amount, note: fundNote.trim() || undefined, person: fundPerson.trim() || undefined };
      if (fundAction === "TRANSFER") {
        payload.fromAccount = fundFrom;
        payload.toAccount = fundFrom === "CASH" ? "BANK" : "CASH";
      } else {
        payload.accountType = fundAccount;
      }
      if (fundAction === "WITHDRAW") payload.purpose = fundPurpose.trim();
      if (fundAction === "ADJUST") payload.direction = fundDirection;

      const response = await fetch("/api/data/cashbook-transactions", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không ghi được nghiệp vụ quỹ.");
      await loadFinanceRows();
      setIsFundOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không ghi được nghiệp vụ quỹ.");
    } finally {
      setIsSavingFund(false);
    }
  };

  const openReceiptForCustomer = (customer: Customer) => {
    setSelectedCustomerForReceipt(customer.id);
    setReceiptAmount(customer.oldDebt > 0 ? customer.oldDebt : "");
    setReceiptPaymentMethod("CASH");
    setReceiptNote(`Thu nợ ${customer.name}`);
    setReceiptAllocations({});
    setIsReceiptOpen(true);
  };

  const openAdjustDialog = () => {
    if (!isAdmin(user)) return;
    setAdjustDirection("DECREASE");
    setAdjustAmount("");
    setAdjustNote("");
    setIsAdjustOpen(true);
  };

  const submitDebtAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !isAdmin(user)) return;
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Số tiền điều chỉnh không hợp lệ.");
      return;
    }
    if (!adjustNote.trim()) {
      alert("Vui lòng nhập lý do điều chỉnh.");
      return;
    }
    const delta = adjustDirection === "INCREASE" ? amount : -amount;
    setIsSavingAdjust(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/data/customer-debt-adjustments", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ customerId: selectedCustomer.id, delta, note: adjustNote.trim(), idempotencyKey })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không điều chỉnh được công nợ.");
      setIsAdjustOpen(false);
      await Promise.all([loadLiveData(), loadFinanceRows()]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không điều chỉnh được công nợ.");
    } finally {
      setIsSavingAdjust(false);
    }
  };

  const openPromiseForCustomer = (customer: Customer) => {
    const defaultDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    setPromiseAmount(customer.oldDebt > 0 ? customer.oldDebt : "");
    setPromiseDate(defaultDate);
    setPromiseContact("");
    setPromiseNote("");
    setIsPromiseOpen(true);
  };

  const savePromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(promiseAmount);
    if (amount <= 0 || !promiseDate) {
      alert("Vui lòng nhập số tiền và ngày hẹn trả hợp lệ.");
      return;
    }
    setIsSavingPromise(true);
    try {
      const response = await fetch("/api/data/payment-promises", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          promisedAmount: amount,
          promisedDate: promiseDate,
          contactName: promiseContact.trim() || undefined,
          note: promiseNote.trim() || undefined
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được hẹn trả nợ.");
      setIsPromiseOpen(false);
      await loadFinanceRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được hẹn trả nợ.");
    } finally {
      setIsSavingPromise(false);
    }
  };

  const resolvePromise = async (promiseId: string, status: "KEPT" | "BROKEN") => {
    const label = status === "KEPT" ? "ĐÃ TRẢ đúng hẹn" : "THẤT HỨA";
    if (!window.confirm(`Đánh dấu hẹn trả này là ${label}?`)) return;
    try {
      const response = await fetch("/api/data/payment-promises", {
        method: "PATCH",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ id: promiseId, status })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không cập nhật được hẹn trả.");
      await loadFinanceRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không cập nhật được hẹn trả.");
    }
  };

  const selectReceiptCustomer = (customerId: string) => {
    setSelectedCustomerForReceipt(customerId);
    const customer = customers.find((item) => item.id === customerId);
    if (customer) setReceiptAmount(customer.oldDebt);
    setReceiptAllocations({});
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(receiptAmount);
    if (!selectedCustomerForReceipt || amount <= 0) {
      alert("Vui lòng chọn khách hàng và nhập số tiền hợp lệ");
      return;
    }
    if (allocatedReceiptAmount > amount) {
      alert("Tổng phân bổ không được lớn hơn số tiền thu.");
      return;
    }
    if (!isAuthenticated) {
      alert("Bạn cần đăng nhập Google trước khi thu nợ.");
      return;
    }

    setIsSavingReceipt(true);
    try {
      const response = await fetch("/api/receipts/create", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomerForReceipt,
          amount,
          paymentMethod: receiptPaymentMethod,
          note: receiptNote.trim() || "Thu nợ từ màn hình tài chính",
          allocations: Object.entries(receiptAllocations).filter(([, value]) => Number(value) > 0).map(([orderDebtId, value]) => ({ orderDebtId, amount: Number(value) }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Không lưu được phiếu thu");
      }
      await loadLiveData();
      await loadFinanceRows();
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
    setReceiptNote("");
    setReceiptAllocations({});
  };

  return (
    <div data-mobile-page="finance" data-mobile-theme={themeId} className="mobile-mockup-page flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 gap-3 sm:gap-4">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <div className="flex shrink-0 rounded-[var(--radius-control)] bg-zinc-100 p-1 text-sm font-bold">
            <span className="rounded-md bg-white px-3 py-1.5 text-emerald-700 shadow-sm">Tổng quan & công nợ</span>
            <Link to="/expenses" className="rounded-md px-3 py-1.5 text-zinc-600 hover:text-zinc-900">Chi phí & kết quả</Link>
          </div>
          <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)} className="h-9 shrink-0 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-sm"><option value="MONTH">Tháng này</option><option value="30_DAYS">30 ngày gần đây</option><option value="ALL">Tất cả thời gian</option></select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" onClick={() => openFundDialog("TRANSFER")} className="w-full sm:w-auto">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Chuyển quỹ
          </Button>
          <Button variant="outline" onClick={() => openFundDialog("WITHDRAW")} className="w-full sm:w-auto">
            <Wallet className="h-4 w-4 mr-2" />
            Rút quỹ
          </Button>
          {canAdjustFund && (
            <Button variant="outline" onClick={() => openFundDialog("ADJUST")} className="w-full sm:w-auto">
              Điều chỉnh quỹ
            </Button>
          )}
          <Button onClick={() => setIsReceiptOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Lập phiếu thu
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Doanh thu kỳ</span></div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate tabular-nums">{periodRevenue.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Đã thu kỳ</span></div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate tabular-nums">{periodCollected.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải thu</span></div>
            <div className="text-lg sm:text-2xl font-bold text-red-600 truncate tabular-nums">{totalReceivables.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải trả</span></div>
            <div className="text-lg sm:text-2xl font-bold text-red-600 truncate tabular-nums">{totalPayables.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Sổ quỹ tiền mặt</span></div>
            <div className="text-lg sm:text-2xl font-bold text-zinc-900 truncate tabular-nums">{cashBalance.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Số dư ngân hàng</span></div>
            <div className="text-lg sm:text-2xl font-bold text-zinc-900 truncate tabular-nums">{bankBalance.toLocaleString()} ₫</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div id="cong-no" className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-zinc-900">Tuổi nợ</h2>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {[
                  ["all", "Tất cả"],
                  ["0-7", "0-7 ngày"],
                  ["8-15", "8-15"],
                  ["16-30", "16-30"],
                  ["30+", ">30"]
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setAgingFilter(key as AgingFilter); setDebtPage(1); }}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold ${
                      agingFilter === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["0-7", customers.filter((c) => c.oldDebt > 0 && (debtAgeByCustomer.get(c.id) ?? 0) <= 7).length],
                ["8-15", customers.filter((c) => (debtAgeByCustomer.get(c.id) ?? 0) >= 8 && (debtAgeByCustomer.get(c.id) ?? 0) <= 15).length],
                ["16-30", customers.filter((c) => (debtAgeByCustomer.get(c.id) ?? 0) >= 16 && (debtAgeByCustomer.get(c.id) ?? 0) <= 30).length],
                [">30", customers.filter((c) => (debtAgeByCustomer.get(c.id) ?? 0) > 30).length]
              ].map(([label, count]) => (
                <div key={label} className="rounded-[var(--radius-control)] bg-zinc-50 p-3">
                  <div className="text-xs font-bold text-zinc-500">{label}</div>
                  <div className="mt-1 text-xl font-black text-zinc-900">{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-zinc-900">Phiếu thu gần nhất</h2>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{periodReceipts.length}</span>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto custom-scrollbar">
              {periodReceipts.slice(0, 6).map((receipt) => {
                const customer = customers.find((item) => item.id === receipt.customer_id);
                return (
                  <div key={receipt.id} className="rounded-[var(--radius-control)] border border-zinc-100 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-emerald-700">{receipt.code}</div>
                        <div className="truncate text-xs text-zinc-500">{customer?.name ?? receipt.customer_id}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-zinc-900">{Number(receipt.amount ?? 0).toLocaleString()} ₫</div>
                        <div className="text-xs text-zinc-500">{receipt.payment_method}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {periodReceipts.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">Chưa có phiếu thu trong kỳ.</div>}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs"><span className="font-semibold text-zinc-500">Chi từ sổ quỹ trong kỳ</span><span className="font-black tabular-nums text-red-600">{periodExpense.toLocaleString()} ₫</span></div>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-zinc-900">Sổ quỹ gần đây</h2>
            <span className="text-xs font-semibold text-zinc-500">Tiền mặt {cashBalance.toLocaleString()} ₫ · Ngân hàng {bankBalance.toLocaleString()} ₫</span>
          </div>
          <div className="space-y-2">
            {cashbookEntries.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-bold text-zinc-900">
                    {CASHBOOK_SOURCE_LABEL[entry.source_type ?? ""] ?? entry.source_type ?? "Sổ quỹ"}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-bold ${entry.account_type === "BANK" ? "bg-zinc-100 text-zinc-700" : "bg-emerald-50 text-emerald-700"}`}>{entry.account_type === "BANK" ? "Ngân hàng" : "Tiền mặt"}</span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {[entry.person && `Người: ${entry.person}`, entry.note].filter(Boolean).join(" · ") || entry.code}
                    {" · "}{new Date(entry.created_at).toLocaleString("vi-VN")}
                  </div>
                </div>
                <div className={`shrink-0 font-black tabular-nums ${entry.direction === "OUT" ? "text-red-600" : "text-emerald-700"}`}>
                  {entry.direction === "OUT" ? "-" : "+"}{Number(entry.amount ?? 0).toLocaleString()} ₫
                </div>
              </div>
            ))}
            {cashbookEntries.length === 0 && <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">Chưa có giao dịch sổ quỹ.</div>}
          </div>
        </div>

        {/* Reminders & Ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-[var(--radius-card)] border border-zinc-200 shadow-sm p-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" /> Nhắc nợ cần xử lý
              </h2>
              <span className="text-xs font-medium bg-red-50 text-red-700 px-2 py-1 rounded-full">{openDebtOrders.length} đơn nợ</span>
            </div>
            
            <div className="space-y-3">
              {debtReminders.map(({ customer, orders: customerOrders, priority }) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomer(customer)}
                  className="flex w-full flex-col justify-between rounded-[var(--radius-control)] border border-zinc-100 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.98] sm:flex-row sm:items-center"
                >
                  <div className="mb-2 flex min-w-0 items-start gap-3 sm:mb-0">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <UserCircle className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words font-bold uppercase text-zinc-900">{customer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{customerOrders.length} đơn hàng còn nợ</div>
                    </div>
                  </div>
                  <div className="flex min-w-0 sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-0 border-zinc-200 pt-2 sm:pt-0">
                    <div className="max-w-full truncate font-bold text-red-600 text-base">{customer.oldDebt.toLocaleString()} ₫</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${priority === 'Vượt hạn mức' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {priority}
                    </div>
                  </div>
                </button>
              ))}
              {debtReminders.length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  <AlertCircle className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  Chưa có khách hàng đang nợ.
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-[var(--radius-card)] border border-zinc-200 shadow-sm p-5 flex flex-col justify-center items-center text-center h-full min-h-[200px]">
            <h2 className="font-semibold text-zinc-500 uppercase tracking-wider text-sm mb-4">Tỷ lệ thu trong kỳ</h2>
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="text-zinc-100" strokeWidth="12" fill="none" stroke="currentColor" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className="text-emerald-500 transition-all duration-1000 ease-in-out" 
                  strokeWidth="12" fill="none" stroke="currentColor"
                  strokeDasharray="351.858"
                  strokeDashoffset={351.858 - (351.858 * (periodRevenue > 0 ? Math.min(1, periodCollected / periodRevenue) : 0))}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-zinc-900">
                  {periodRevenue > 0
                    ? `${Math.round((periodCollected / periodRevenue) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 px-4">Đã thu trong kỳ / doanh thu đơn hàng trong kỳ.</p>
          </div>
        </div>

        {/* Debt Management Section */}
        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 flex flex-col min-h-[480px]">
            <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Quản lý công nợ khách hàng</h2>
                <div className="mt-1 text-sm text-zinc-500">{filteredCustomers.length} khách còn công nợ</div>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setDebtPage(1); }}
                  placeholder="Tìm khách hàng..."
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="hidden md:flex overflow-auto flex-1 custom-scrollbar">
              <table className="min-w-[860px] w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Khách hàng</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">SĐT</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nợ hiện tại</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tuổi nợ</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-200">
                  {pagedCustomers.map((customer) => {
                    const selected = selectedCustomer?.id === customer.id;
                    const age = debtAgeByCustomer.get(customer.id) ?? 0;
                    return (
                      <tr 
                        key={customer.id} 
                        className={`${selected ? "bg-emerald-50/70" : "hover:bg-zinc-50"} cursor-pointer transition-colors`}
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <td className="px-5 py-4 text-sm font-bold text-zinc-900 uppercase">
                          <div className="line-clamp-2">{customer.name}</div>
                          <div className="mt-1 text-xs font-medium normal-case text-zinc-400">{customer.id}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500">{customer.phone || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                          {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() + ' ₫' : "0 ₫"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-semibold text-zinc-700">
                          {customer.oldDebt > 0 ? `${age} ngày` : "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            customer.oldDebt > customer.creditLimit && customer.creditLimit > 0
                              ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                              : customer.oldDebt > 0
                                ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                          }`}>
                            {customer.oldDebt > customer.creditLimit && customer.creditLimit > 0 ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                          </span>
                          {overduePromiseCustomerIds.has(customer.id) && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase text-red-700">Trễ hẹn</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex-1 overflow-y-auto space-y-3 p-3 sm:p-4 custom-scrollbar">
              {pagedCustomers.map((customer) => {
                const selected = selectedCustomer?.id === customer.id;
                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`${selected ? "border-emerald-300 bg-emerald-50/60" : "bg-white border-zinc-200"} p-3 sm:p-4 rounded-[var(--radius-card)] border shadow-sm active:scale-[0.98] transition-transform`}
                  >
                    <div className="flex min-w-0 justify-between items-start mb-3 gap-3">
                      <div className="min-w-0">
                        <h3 className="mb-1 line-clamp-2 break-words text-base font-bold uppercase text-zinc-900">{customer.name}</h3>
                        <div className="truncate text-sm font-medium text-zinc-500">{customer.phone || "-"}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          customer.oldDebt > customer.creditLimit && customer.creditLimit > 0
                            ? 'bg-red-50 text-red-700'
                            : customer.oldDebt > 0
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {customer.oldDebt > customer.creditLimit && customer.creditLimit > 0 ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                        </span>
                        {overduePromiseCustomerIds.has(customer.id) && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Trễ hẹn</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-100">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-400 mb-0.5">Nợ hiện tại</div>
                        <div className="truncate text-lg font-bold text-red-600 leading-none">{customer.oldDebt.toLocaleString()} ₫</div>
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="text-xs font-medium text-zinc-400 mb-0.5">Tuổi nợ</div>
                        <div className="truncate text-sm font-semibold text-zinc-700">{customer.oldDebt > 0 ? `${debtAgeByCustomer.get(customer.id) ?? 0} ngày` : "-"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-10 text-zinc-500">
                  <p>Không tìm thấy khách hàng nào</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-zinc-500">Trang {debtPage}/{debtTotalPages}</span>
              <div className="flex items-center gap-2">
                <select value={debtPageSize} onChange={(event) => { setDebtPageSize(Number(event.target.value)); setDebtPage(1); }} className="h-9 rounded-md border border-zinc-200 bg-white px-2"><option value={10}>10 / trang</option><option value={20}>20 / trang</option><option value={50}>50 / trang</option></select>
                <Button size="sm" variant="outline" disabled={debtPage <= 1} onClick={() => setDebtPage((current) => current - 1)}>Trước</Button>
                <Button size="sm" variant="outline" disabled={debtPage >= debtTotalPages} onClick={() => setDebtPage((current) => current + 1)}>Sau</Button>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
            {selectedCustomer ? (
              <div className="flex max-h-[calc(100vh-140px)] flex-col overflow-hidden">
                <div className="border-b border-zinc-100 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">{selectedCustomer.phone || "Chưa có SĐT"}</div>
                  <div className="mt-1 break-words text-xl font-black uppercase text-zinc-900">{selectedCustomer.name}</div>
                  <div className="mt-2 line-clamp-2 text-sm text-zinc-500">{selectedCustomer.address || "Chưa có địa chỉ"}</div>
                </div>

                <div className="custom-scrollbar overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius-card)] border border-red-100 bg-red-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-red-700">Nợ hiện tại</div>
                      <div className="mt-1 truncate text-2xl font-black text-red-600">{selectedCustomer.oldDebt.toLocaleString()} ₫</div>
                    </div>
                    <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hạn mức</div>
                      <div className="mt-1 truncate text-xl font-black text-zinc-900">{selectedCustomer.creditLimit.toLocaleString()} ₫</div>
                    </div>
                    <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tuổi nợ</div>
                      <div className="mt-1 text-xl font-black text-zinc-900">{selectedCustomer.oldDebt > 0 ? `${selectedOldestDebtAge} ngày` : "-"}</div>
                    </div>
                    <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Đơn còn nợ</div>
                      <div className="mt-1 text-xl font-black text-zinc-900">{selectedDebtOrders.length}</div>
                    </div>
                  </div>
                  {isAdmin(user) && (
                    <Button type="button" variant="outline" className="w-full" onClick={openAdjustDialog}>
                      Điều chỉnh công nợ có ghi sổ
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Doanh số</div>
                      <div className="mt-1 font-black text-zinc-900">{selectedTotalSales.toLocaleString()} ₫</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Đã thu</div>
                      <div className="mt-1 font-black text-emerald-600">{selectedTotalPaid.toLocaleString()} ₫</div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-bold text-zinc-900">Đơn hàng còn nợ</h3>
                      <span className="text-xs font-bold text-red-600">{selectedDebtOrders.length}</span>
                    </div>
                    <div className="space-y-2">
                      {selectedDebtOrders.slice(0, 8).map((order) => (
                        <div key={order.id} className="rounded-[var(--radius-control)] border border-zinc-200 bg-white p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-bold text-emerald-700">{order.id}</div>
                              <div className="text-xs text-zinc-500">{new Date(order.date).toLocaleDateString('vi-VN')}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="font-bold text-red-600">{(order.total - order.paid).toLocaleString()} ₫</div>
                              <div className="text-xs text-zinc-500">Tổng {order.total.toLocaleString()} ₫</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedDebtOrders.length === 0 && (
                        <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-500">Không còn đơn nợ.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-bold text-zinc-900">Hẹn trả nợ</h3>
                      <span className="text-xs font-bold text-amber-600">{selectedCustomerPromises.filter((promise) => promise.status === "OPEN").length}</span>
                    </div>
                    <div className="space-y-2">
                      {selectedCustomerPromises.slice(0, 5).map((promise) => {
                        const isOverdue = promise.status === "OPEN" && promise.promised_date < todayIso;
                        return (
                          <div key={promise.id} className={`rounded-[var(--radius-control)] border p-3 text-sm ${isOverdue ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-zinc-900">{new Date(promise.promised_date).toLocaleDateString("vi-VN")}</div>
                                <div className="text-xs text-zinc-500">{promise.contact_name || promise.note || "—"}</div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className={`font-bold ${isOverdue ? "text-red-600" : "text-amber-600"}`}>{Number(promise.promised_amount ?? 0).toLocaleString()} ₫</div>
                                <span className={`text-[10px] font-bold uppercase ${
                                  promise.status === "KEPT" ? "text-emerald-600" : promise.status === "BROKEN" ? "text-red-500" : isOverdue ? "text-red-600" : "text-amber-600"
                                }`}>
                                  {promise.status === "KEPT" ? "Đã trả" : promise.status === "BROKEN" ? "Thất hứa" : isOverdue ? "Trễ hẹn" : "Chờ trả"}
                                </span>
                              </div>
                            </div>
                            {promise.status === "OPEN" && (
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => void resolvePromise(promise.id, "KEPT")} className="flex-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Đã trả</button>
                                <button type="button" onClick={() => void resolvePromise(promise.id, "BROKEN")} className="flex-1 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100">Thất hứa</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {selectedCustomerPromises.length === 0 && (
                        <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 bg-zinc-50 py-4 text-center text-sm text-zinc-500">Chưa có hẹn trả nợ.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-bold text-zinc-900">Phiếu thu</h3>
                      <span className="text-xs font-bold text-emerald-600">{selectedCustomerReceipts.length}</span>
                    </div>
                    <div className="space-y-2">
                      {selectedCustomerReceipts.slice(0, 6).map((receipt) => (
                        <div key={receipt.id} className="flex items-center justify-between rounded-[var(--radius-control)] border border-zinc-200 bg-white p-3 text-sm">
                          <div>
                            <div className="font-bold text-zinc-900">{receipt.code}</div>
                            <div className="text-xs text-zinc-500">{new Date(receipt.receipt_date).toLocaleDateString("vi-VN")} · {receipt.payment_method}</div>
                          </div>
                          <div className="font-bold text-emerald-600">{Number(receipt.amount ?? 0).toLocaleString()} ₫</div>
                        </div>
                      ))}
                      {selectedCustomerReceipts.length === 0 && (
                        <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-500">Chưa có phiếu thu.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 p-4">
                  <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Bỏ chọn</Button>
                  <Button variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => openPromiseForCustomer(selectedCustomer)}>Hẹn trả</Button>
                  <Button onClick={() => openReceiptForCustomer(selectedCustomer)}>Thu nợ</Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
                <UserCircle className="h-12 w-12 text-zinc-300" />
                <div className="mt-3 font-bold text-zinc-900">Chọn một khách hàng</div>
                <div className="mt-1 text-sm text-zinc-500">Chi tiết công nợ, đơn còn nợ và phiếu thu sẽ hiện ngay tại đây.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isFundOpen}
        onClose={() => setIsFundOpen(false)}
        title={fundAction === "TRANSFER" ? "Chuyển quỹ" : fundAction === "WITHDRAW" ? "Rút quỹ" : "Điều chỉnh số dư quỹ"}
      >
        <form onSubmit={handleFundSubmit} className="flex h-full flex-col">
          <div className="flex-1 space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tồn quỹ tiền mặt</div>
                <div className="mt-1 font-black tabular-nums text-zinc-900">{cashBalance.toLocaleString()} ₫</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Số dư ngân hàng</div>
                <div className="mt-1 font-black tabular-nums text-zinc-900">{bankBalance.toLocaleString()} ₫</div>
              </div>
            </div>

            {fundAction === "TRANSFER" && (
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-700">Chiều chuyển</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFundFrom("CASH")} className={`rounded-[var(--radius-card)] py-3 text-center text-sm font-semibold min-h-[48px] ${fundFrom === "CASH" ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>
                    Tiền mặt → Ngân hàng
                  </button>
                  <button type="button" onClick={() => setFundFrom("BANK")} className={`rounded-[var(--radius-card)] py-3 text-center text-sm font-semibold min-h-[48px] ${fundFrom === "BANK" ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>
                    Ngân hàng → Tiền mặt
                  </button>
                </div>
              </div>
            )}

            {fundAction !== "TRANSFER" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-700">{fundAction === "WITHDRAW" ? "Rút từ" : "Quỹ điều chỉnh"}</label>
                  <select value={fundAccount} onChange={(event) => setFundAccount(event.target.value as "CASH" | "BANK")} className="h-11 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-[16px] sm:h-10 sm:text-sm">
                    <option value="CASH">Quỹ tiền mặt</option>
                    <option value="BANK">Tài khoản ngân hàng</option>
                  </select>
                </div>
                {fundAction === "ADJUST" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-zinc-700">Loại điều chỉnh</label>
                    <select value={fundDirection} onChange={(event) => setFundDirection(event.target.value as "IN" | "OUT")} className="h-11 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-[16px] sm:h-10 sm:text-sm">
                      <option value="IN">Ghi tăng (nhập số dư đầu/thiếu)</option>
                      <option value="OUT">Ghi giảm (số dư thừa)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Số tiền</label>
              <Input
                type="number"
                min={1000}
                required
                value={fundAmount}
                onChange={(event) => setFundAmount(Number(event.target.value) || "")}
                placeholder="0"
                className="text-lg font-bold text-emerald-600"
              />
            </div>

            {fundAction === "WITHDRAW" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-700">Mục đích rút (*)</label>
                  <Input value={fundPurpose} onChange={(event) => setFundPurpose(event.target.value)} placeholder="VD: Chi tiêu văn phòng..." required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-700">Người rút (*)</label>
                  <Input value={fundPerson} onChange={(event) => setFundPerson(event.target.value)} placeholder="VD: Anh Nam" required />
                </div>
              </div>
            )}

            {fundAction !== "WITHDRAW" && (
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-700">Người thực hiện</label>
                <Input value={fundPerson} onChange={(event) => setFundPerson(event.target.value)} placeholder="VD: Kế toán Lan" />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-zinc-700">Ghi chú</label>
              <textarea value={fundNote} onChange={(event) => setFundNote(event.target.value)} rows={2} placeholder={fundAction === "TRANSFER" ? "VD: Nộp tiền bán hàng vào tài khoản..." : "Ghi chú thêm..."} className="w-full resize-none rounded-[var(--radius-control)] border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>

          <div className="mt-8 flex gap-3 border-t border-zinc-100 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsFundOpen(false)}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={isSavingFund}>
              {isSavingFund ? "Đang ghi..." : fundAction === "TRANSFER" ? "Xác nhận chuyển" : fundAction === "WITHDRAW" ? "Xác nhận rút" : "Xác nhận điều chỉnh"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Lập Phiếu Thu">
        <form onSubmit={handleReceiptSubmit} className="flex flex-col h-full">
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Chọn Khách hàng</label>
              <SearchableSelect value={selectedCustomerForReceipt} onChange={selectReceiptCustomer} required placeholder="-- Chọn khách hàng --" searchPlaceholder="Tìm tên, SĐT khách hàng..." options={customers.filter((customer) => customer.oldDebt > 0).map((customer) => ({ value: customer.id, label: customer.name, description: `${customer.phone || "Chưa có SĐT"} · Nợ ${customer.oldDebt.toLocaleString()} đ` }))} />
            </div>
            
            {selectedCustomerForReceipt && (
              <div className="bg-red-50 p-4 rounded-[var(--radius-card)] border border-red-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-red-800">Số nợ hiện tại:</span>
                <span className="text-xl font-bold text-red-600">
                  {customers.find(c => c.id === selectedCustomerForReceipt)?.oldDebt.toLocaleString()} ₫
                </span>
              </div>
            )}

            {selectedCustomerForReceipt && selectedCustomerDebtRows.length > 0 && (
              <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between"><div><div className="font-bold text-zinc-900">Phân bổ vào đơn nợ</div><div className="text-xs text-zinc-500">Để trống để hệ thống thu theo đơn đến hạn trước.</div></div><div className={`text-sm font-black tabular-nums ${allocatedReceiptAmount > Number(receiptAmount || 0) ? "text-red-600" : "text-emerald-700"}`}>{allocatedReceiptAmount.toLocaleString()} ₫</div></div>
                <div className="max-h-44 space-y-2 overflow-y-auto custom-scrollbar">
                  {selectedCustomerDebtRows.map((debt) => {
                    const order = orders.find((item) => item.dbId === debt.order_id);
                    return <div key={debt.id} className="grid grid-cols-[1fr_132px] items-center gap-3 rounded-[var(--radius-control)] bg-zinc-50 px-3 py-2"><div className="min-w-0"><div className="truncate font-bold text-zinc-900">{order?.id ?? debt.order_id}</div><div className="text-xs text-zinc-500">Còn {Number(debt.remaining_amount).toLocaleString()} ₫ · Hạn {debt.due_date ? new Date(debt.due_date).toLocaleDateString("vi-VN") : "chưa đặt"}</div></div><Input name={`allocation-${debt.id}`} type="number" min="0" max={Number(debt.remaining_amount)} value={receiptAllocations[debt.id] || ""} onChange={(event) => setReceiptAllocations((current) => ({ ...current, [debt.id]: Math.min(Number(event.target.value) || 0, Number(debt.remaining_amount)) }))} className="text-right font-bold" placeholder="0" /></div>;
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Số tiền thu</label>
              <Input 
                type="number" 
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(Number(e.target.value) || '')}
                placeholder="0"
                required
                min={1000}
                className="text-lg font-bold text-emerald-600"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-bold text-zinc-700">Phương thức thu</label><select value={receiptPaymentMethod} onChange={(event) => setReceiptPaymentMethod(event.target.value)} className="flex h-11 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:h-10 sm:text-sm"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></div>
              <div><label className="mb-2 block text-sm font-bold text-zinc-700">Ngày thu</label><Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} disabled /></div>
            </div>
            <div><label className="mb-2 block text-sm font-bold text-zinc-700">Nội dung / ghi chú</label><textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} rows={3} placeholder="VD: Thu công nợ đơn DH..." className="w-full resize-none rounded-[var(--radius-control)] border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" /></div>
          </div>
          
          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button 
              type="button" 
              onClick={() => setIsReceiptOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Hủy
            </Button>
            <Button 
              type="submit"
              disabled={isSavingReceipt}
              className="flex-1"
            >
              {isSavingReceipt ? "Đang xử lý..." : "Xác nhận thu tiền"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={isPromiseOpen} onClose={() => setIsPromiseOpen(false)} title={`Hẹn trả nợ${selectedCustomer ? ` — ${selectedCustomer.name}` : ""}`}>
        <form onSubmit={savePromise} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-700">Ngày hẹn trả *</label>
              <Input type="date" value={promiseDate} min={todayIso} onChange={(event) => setPromiseDate(event.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-700">Số tiền hẹn trả *</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={promiseAmount}
                onChange={(event) => setPromiseAmount(event.target.value === "" ? "" : Number(event.target.value))}
                placeholder="0"
                required
              />
            </div>
          </div>
          {typeof promiseAmount === "number" && promiseAmount > 0 && (
            <div className="rounded-[var(--radius-control)] bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">{promiseAmount.toLocaleString()} ₫</div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">Người hẹn / liên hệ</label>
            <Input value={promiseContact} onChange={(event) => setPromiseContact(event.target.value)} placeholder="VD: Anh Ba - chủ cửa hàng" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">Ghi chú</label>
            <textarea value={promiseNote} onChange={(event) => setPromiseNote(event.target.value)} rows={2} placeholder="VD: Hẹn trả sau khi bán xong lô hàng..." className="w-full resize-none rounded-[var(--radius-control)] border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPromiseOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSavingPromise} className="flex-1">{isSavingPromise ? "Đang lưu..." : "Lưu hẹn trả"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title={`Điều chỉnh công nợ${selectedCustomer ? ` — ${selectedCustomer.name}` : ""}`}>
        <form onSubmit={submitDebtAdjustment} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">Loại điều chỉnh</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustDirection("DECREASE")}
                className={`rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-bold ${adjustDirection === "DECREASE" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-600"}`}
              >
                Giảm nợ
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection("INCREASE")}
                className={`rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-bold ${adjustDirection === "INCREASE" ? "border-red-500 bg-red-50 text-red-600" : "border-zinc-200 bg-white text-zinc-600"}`}
              >
                Tăng nợ
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">Số tiền *</label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={adjustAmount}
              onChange={(event) => setAdjustAmount(event.target.value === "" ? "" : Number(event.target.value))}
              placeholder="0"
              required
            />
            {typeof adjustAmount === "number" && adjustAmount > 0 && selectedCustomer && (
              <div className={`mt-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold ${adjustDirection === "INCREASE" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                {adjustDirection === "INCREASE" ? "+" : "−"}{adjustAmount.toLocaleString()} ₫ → Nợ mới: {Math.max(0, selectedCustomer.oldDebt + (adjustDirection === "INCREASE" ? adjustAmount : -adjustAmount)).toLocaleString()} ₫
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">Lý do điều chỉnh *</label>
            <textarea value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} rows={2} required placeholder="VD: Trừ nợ hàng trả lại, chốt sổ đầu kỳ..." className="w-full resize-none rounded-[var(--radius-control)] border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdjustOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSavingAdjust} className="flex-1">{isSavingAdjust ? "Đang lưu..." : "Xác nhận điều chỉnh"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
