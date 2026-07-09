import React, { useEffect, useMemo, useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { Bell, DollarSign, Wallet, FileText, Search, Plus, UserCircle, AlertCircle } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { useAuthStore } from "../store/auth";
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

type AgingFilter = "all" | "0-7" | "8-15" | "16-30" | "30+";

export function Finance() {
  const { customers, orders, loadLiveData } = useDataStore();
  const { isAuthenticated } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedCustomerForReceipt, setSelectedCustomerForReceipt] = useState("");
  const [receiptAmount, setReceiptAmount] = useState<number | ''>('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState("CASH");
  const [receiptNote, setReceiptNote] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");
  const [debtPage, setDebtPage] = useState(1);
  const [debtPageSize, setDebtPageSize] = useState(20);

  const loadFinanceRows = async () => {
    try {
      const response = await fetch("/api/data/receipts", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (response.ok && body.ok) setReceipts(body.rows ?? []);
    } catch {
      setReceipts([]);
    }
  };

  useEffect(() => {
    loadFinanceRows();
  }, []);

  const totalReceivables = customers.reduce((acc, c) => acc + c.oldDebt, 0);
  const totalCashIn = orders.reduce((acc, order) => acc + order.paid, 0);
  const openDebtOrders = orders.filter((order) => order.total > order.paid);
  const transferCashIn = receipts
    .filter((receipt) => receipt.payment_method === "TRANSFER")
    .reduce((sum, receipt) => sum + Number(receipt.amount ?? 0), 0);
  const cashReceipts = receipts
    .filter((receipt) => receipt.payment_method !== "TRANSFER")
    .reduce((sum, receipt) => sum + Number(receipt.amount ?? 0), 0);
  const debtAgeByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    const today = new Date();
    for (const order of openDebtOrders) {
      if (!order.customerId) continue;
      const age = Math.max(0, Math.floor((today.getTime() - new Date(order.date).getTime()) / 86400000));
      map.set(order.customerId, Math.max(map.get(order.customerId) ?? 0, age));
    }
    return map;
  }, [openDebtOrders]);
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
  const selectedTotalSales = selectedCustomerOrders.reduce((sum, order) => sum + order.total, 0);
  const selectedTotalPaid = selectedCustomerOrders.reduce((sum, order) => sum + order.paid, 0);
  const selectedOldestDebtAge = selectedCustomer ? debtAgeByCustomer.get(selectedCustomer.id) ?? 0 : 0;

  const openReceiptForCustomer = (customer: Customer) => {
    setSelectedCustomerForReceipt(customer.id);
    setReceiptAmount(customer.oldDebt > 0 ? customer.oldDebt : "");
    setReceiptPaymentMethod("CASH");
    setReceiptNote(`Thu nợ ${customer.name}`);
    setIsReceiptOpen(true);
  };

  const selectReceiptCustomer = (customerId: string) => {
    setSelectedCustomerForReceipt(customerId);
    const customer = customers.find((item) => item.id === customerId);
    if (customer) setReceiptAmount(customer.oldDebt);
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(receiptAmount);
    if (!selectedCustomerForReceipt || amount <= 0) {
      alert("Vui lòng chọn khách hàng và nhập số tiền hợp lệ");
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
          note: receiptNote.trim() || "Thu nợ từ màn hình tài chính"
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
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 gap-3 sm:gap-4">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Tài chính & Công nợ</h1>
        <Button onClick={() => setIsReceiptOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Lập phiếu thu
        </Button>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4 sm:space-y-6">
        {/* Top KPI Cards (Bento Style) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Quỹ tiền mặt</span></div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate">{cashReceipts.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Tiền gửi NH</span></div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate">{transferCashIn.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải thu</span></div>
            <div className="text-lg sm:text-2xl font-bold text-red-600 truncate">{totalReceivables.toLocaleString()} ₫</div>
          </div>
          <div className="min-w-0 bg-white p-2 sm:p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="mb-1 flex min-h-[28px] items-start gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-xs"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="line-clamp-2">Phải trả</span></div>
            <div className="text-base sm:text-xl font-bold text-zinc-400 mt-1 truncate">Chờ nhập NCC</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
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
                <div key={label} className="rounded-lg bg-zinc-50 p-3">
                  <div className="text-xs font-bold text-zinc-500">{label}</div>
                  <div className="mt-1 text-xl font-black text-zinc-900">{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-zinc-900">Phiếu thu gần nhất</h2>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{receipts.length}</span>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto custom-scrollbar">
              {receipts.slice(0, 6).map((receipt) => {
                const customer = customers.find((item) => item.id === receipt.customer_id);
                return (
                  <div key={receipt.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
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
              {receipts.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">Chưa có phiếu thu.</div>}
            </div>
          </div>
        </div>

        {/* Reminders & Ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" /> Nhắc nợ cần xử lý
              </h2>
              <span className="text-xs font-medium bg-red-50 text-red-700 px-2 py-1 rounded-full">{openDebtOrders.length} đơn nợ</span>
            </div>
            
            <div className="space-y-3">
              {debtReminders.map(({ customer, orders: customerOrders, priority }) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50 hover:border-zinc-300 cursor-pointer transition-colors active:scale-[0.98]"
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
                </div>
              ))}
              {debtReminders.length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  <AlertCircle className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  Chưa có khách hàng đang nợ.
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col justify-center items-center text-center h-full min-h-[200px]">
            <h2 className="font-semibold text-zinc-500 uppercase tracking-wider text-sm mb-4">Tỷ lệ thu tiền</h2>
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="text-zinc-100" strokeWidth="12" fill="none" stroke="currentColor" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className="text-emerald-500 transition-all duration-1000 ease-in-out" 
                  strokeWidth="12" fill="none" stroke="currentColor"
                  strokeDasharray="351.858"
                  strokeDashoffset={351.858 - (351.858 * (orders.reduce((sum, order) => sum + order.total, 0) > 0 ? (totalCashIn / orders.reduce((sum, order) => sum + order.total, 0)) : 0))}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-zinc-900">
                  {orders.reduce((sum, order) => sum + order.total, 0) > 0
                    ? `${Math.round((totalCashIn / orders.reduce((sum, order) => sum + order.total, 0)) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 px-4">Tính trên tổng đã thu / tổng doanh số (Supabase).</p>
          </div>
        </div>

        {/* Debt Management Section */}
        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col min-h-[480px]">
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
                    className={`${selected ? "border-emerald-300 bg-emerald-50/60" : "bg-white border-zinc-200"} p-3 sm:p-4 rounded-xl border shadow-sm active:scale-[0.98] transition-transform`}
                  >
                    <div className="flex min-w-0 justify-between items-start mb-3 gap-3">
                      <div className="min-w-0">
                        <h3 className="mb-1 line-clamp-2 break-words text-base font-bold uppercase text-zinc-900">{customer.name}</h3>
                        <div className="truncate text-sm font-medium text-zinc-500">{customer.phone || "-"}</div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        customer.oldDebt > customer.creditLimit && customer.creditLimit > 0
                          ? 'bg-red-50 text-red-700' 
                          : customer.oldDebt > 0 
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {customer.oldDebt > customer.creditLimit && customer.creditLimit > 0 ? 'Vượt hạn mức' : customer.oldDebt > 0 ? 'Đang nợ' : 'An toàn'}
                      </span>
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

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
            {selectedCustomer ? (
              <div className="flex max-h-[calc(100vh-140px)] flex-col overflow-hidden">
                <div className="border-b border-zinc-100 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">{selectedCustomer.phone || "Chưa có SĐT"}</div>
                  <div className="mt-1 break-words text-xl font-black uppercase text-zinc-900">{selectedCustomer.name}</div>
                  <div className="mt-2 line-clamp-2 text-sm text-zinc-500">{selectedCustomer.address || "Chưa có địa chỉ"}</div>
                </div>

                <div className="custom-scrollbar overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-red-700">Nợ hiện tại</div>
                      <div className="mt-1 truncate text-2xl font-black text-red-600">{selectedCustomer.oldDebt.toLocaleString()} ₫</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hạn mức</div>
                      <div className="mt-1 truncate text-xl font-black text-zinc-900">{selectedCustomer.creditLimit.toLocaleString()} ₫</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tuổi nợ</div>
                      <div className="mt-1 text-xl font-black text-zinc-900">{selectedCustomer.oldDebt > 0 ? `${selectedOldestDebtAge} ngày` : "-"}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Đơn còn nợ</div>
                      <div className="mt-1 text-xl font-black text-zinc-900">{selectedDebtOrders.length}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
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
                        <div key={order.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
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
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-500">Không còn đơn nợ.</div>
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
                        <div key={receipt.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                          <div>
                            <div className="font-bold text-zinc-900">{receipt.code}</div>
                            <div className="text-xs text-zinc-500">{new Date(receipt.receipt_date).toLocaleDateString("vi-VN")} · {receipt.payment_method}</div>
                          </div>
                          <div className="font-bold text-emerald-600">{Number(receipt.amount ?? 0).toLocaleString()} ₫</div>
                        </div>
                      ))}
                      {selectedCustomerReceipts.length === 0 && (
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-500">Chưa có phiếu thu.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 p-4">
                  <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Bỏ chọn</Button>
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

      <Dialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Lập Phiếu Thu">
        <form onSubmit={handleReceiptSubmit} className="flex flex-col h-full">
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Chọn Khách hàng</label>
              <SearchableSelect value={selectedCustomerForReceipt} onChange={selectReceiptCustomer} required placeholder="-- Chọn khách hàng --" searchPlaceholder="Tìm tên, SĐT khách hàng..." options={customers.filter((customer) => customer.oldDebt > 0).map((customer) => ({ value: customer.id, label: customer.name, description: `${customer.phone || "Chưa có SĐT"} · Nợ ${customer.oldDebt.toLocaleString()} đ` }))} />
            </div>
            
            {selectedCustomerForReceipt && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-red-800">Số nợ hiện tại:</span>
                <span className="text-xl font-bold text-red-600">
                  {customers.find(c => c.id === selectedCustomerForReceipt)?.oldDebt.toLocaleString()} ₫
                </span>
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
              <div><label className="mb-2 block text-sm font-bold text-zinc-700">Phương thức thu</label><select value={receiptPaymentMethod} onChange={(event) => setReceiptPaymentMethod(event.target.value)} className="flex h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:h-10 sm:text-sm"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option><option value="CARD">Thẻ</option><option value="OTHER">Khác</option></select></div>
              <div><label className="mb-2 block text-sm font-bold text-zinc-700">Ngày thu</label><Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} disabled /></div>
            </div>
            <div><label className="mb-2 block text-sm font-bold text-zinc-700">Nội dung / ghi chú</label><textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} rows={3} placeholder="VD: Thu công nợ đơn DH..." className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600" /></div>
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
    </div>
  );
}
