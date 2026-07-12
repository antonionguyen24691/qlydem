import React, { useEffect, useMemo, useState } from "react";
import { useDataStore, Customer } from "../store/data";
import { ArrowLeft, Edit3, MapPin, Phone, Receipt, Save, Search, StickyNote, UserPlus, Users } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getAuthHeaders } from "../lib/supabase";
import { exportSalesOrderXlsx, printSalesOrder, shareSalesOrderImage } from "../lib/printBill";
import type { Order } from "../store/data";

type CustomerForm = {
  id?: string;
  code?: string;
  name: string;
  phone: string;
  address: string;
  oldDebt: number;
  creditLimit: number;
  note: string;
  customerGroup: string;
};

type DebtLedgerRow = {
  id: string;
  customer_id: string;
  order_id?: string | null;
  source_type: string;
  source_id?: string | null;
  debit: number;
  credit: number;
  balance_after: number;
  created_at: string;
  note?: string | null;
};

type ReceiptRow = {
  id: string;
  code: string;
  amount: number;
  receipt_date?: string;
  payment_method?: string;
  note?: string | null;
};

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  address: "",
  oldDebt: 0,
  creditLimit: 50000000,
  note: "",
  customerGroup: "RETAIL"
};

function shortCode(customer: Customer) {
  return customer.code || customer.id;
}

function toForm(customer?: Customer): CustomerForm {
  if (!customer) return { ...emptyForm };
  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    oldDebt: customer.oldDebt,
    creditLimit: customer.creditLimit,
    note: customer.note ?? "",
    customerGroup: customer.customerGroup ?? "RETAIL"
  };
}

function mapSavedCustomer(row: any): Customer {
  return {
    id: row.id,
    code: row.code,
    name: row.name ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    oldDebt: Number(row.current_debt ?? 0),
    creditLimit: Number(row.credit_limit ?? 0),
    note: row.note ?? "",
    customerGroup: row.customer_group ?? ""
  };
}

export function Customers() {
  const { customers, orders, upsertCustomerLocal, loadLiveData } = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "debt" | "orders" | "notes">("overview");
  const [infoPreview, setInfoPreview] = useState<{ title: string; content: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [debtLedgerRows, setDebtLedgerRows] = useState<DebtLedgerRow[]>([]);
  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  useEffect(() => {
    if (!selectedCustomerId) {
      setDebtLedgerRows([]);
      setReceiptRows([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [ledgerResponse, receiptResponse] = await Promise.all([
          fetch("/api/data/customer_debt_ledger", { headers: await getAuthHeaders() }),
          fetch("/api/data/receipts", { headers: await getAuthHeaders() })
        ]);
        const [ledgerBody, receiptBody] = await Promise.all([
          ledgerResponse.json(),
          receiptResponse.json()
        ]);
        if (cancelled) return;
        if (ledgerResponse.ok && ledgerBody.ok) {
          setDebtLedgerRows((ledgerBody.rows ?? []).filter((row: any) => row.customer_id === selectedCustomerId).map((row: any) => ({
            id: row.id,
            customer_id: row.customer_id,
            order_id: row.order_id,
            source_type: row.source_type,
            source_id: row.source_id,
            debit: Number(row.debit ?? 0),
            credit: Number(row.credit ?? 0),
            balance_after: Number(row.balance_after ?? 0),
            created_at: row.created_at,
            note: row.note
          })));
        } else {
          setDebtLedgerRows([]);
        }
        if (receiptResponse.ok && receiptBody.ok) {
          setReceiptRows((receiptBody.rows ?? []).filter((row: any) => row.customer_id === selectedCustomerId).map((row: any) => ({
            id: row.id,
            code: row.code,
            amount: Number(row.amount ?? 0),
            receipt_date: row.receipt_date,
            payment_method: row.payment_method,
            note: row.note
          })));
        } else {
          setReceiptRows([]);
        }
      } catch {
        if (!cancelled) {
          setDebtLedgerRows([]);
          setReceiptRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  const filteredCustomers = customers.filter((customer) => {
    const term = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(term) ||
      customer.phone.includes(searchTerm) ||
      shortCode(customer).toLowerCase().includes(term)
    );
  });

  const totalDebt = customers.reduce((sum, customer) => sum + customer.oldDebt, 0);
  const debtors = customers.filter((customer) => customer.oldDebt > 0);

  const selectedOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
      .filter((order) => order.customerId === selectedCustomer.id || order.customerName === selectedCustomer.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, selectedCustomer]);

  const selectedRevenue = selectedOrders.reduce((sum, order) => sum + order.total, 0);
  const selectedPaid = debtLedgerRows.length > 0
    ? debtLedgerRows.reduce((sum, row) => sum + row.credit, 0)
    : selectedOrders.reduce((sum, order) => sum + order.paid, 0);

  const debtLedgerDisplayRows = useMemo(() => {
    if (debtLedgerRows.length > 0) {
      return [...debtLedgerRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return selectedOrders.map((order) => ({
      id: order.id,
      customer_id: selectedCustomer?.id ?? "",
      order_id: order.id,
      source_type: "INVOICE",
      source_id: order.id,
      debit: order.total,
      credit: order.paid,
      balance_after: Math.max(0, order.total - order.paid),
      created_at: order.date,
      note: ""
    } as DebtLedgerRow));
  }, [debtLedgerRows, selectedCustomer?.id, selectedOrders]);

  const receiptById = useMemo(() => new Map(receiptRows.map((receipt) => [receipt.id, receipt])), [receiptRows]);
  const orderByCodeOrId = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of selectedOrders) {
      map.set(order.id, order);
      if (order.dbId) map.set(order.dbId, order);
    }
    return map;
  }, [selectedOrders]);

  function ledgerDocument(row: DebtLedgerRow) {
    if (row.source_type === "RECEIPT") {
      const receipt = row.source_id ? receiptById.get(row.source_id) : undefined;
      return receipt?.code ?? `PT-${String(row.source_id ?? row.id).slice(0, 8)}`;
    }
    const order = (row.order_id ? orderByCodeOrId.get(row.order_id) : undefined) ?? (row.source_id ? orderByCodeOrId.get(row.source_id) : undefined);
    return order?.id ?? `HD-${String(row.source_id ?? row.order_id ?? row.id).slice(0, 8)}`;
  }

  function ledgerTypeLabel(row: DebtLedgerRow) {
    if (row.source_type === "RECEIPT") return "Thu tiền";
    if (row.source_type === "INVOICE") return "Bán hàng";
    return row.source_type;
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setIsFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setForm(toForm(customer));
    setIsFormOpen(true);
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      alert("Vui lòng nhập tên khách hàng.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/data/customers", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được khách hàng.");
      const saved = mapSavedCustomer(body.customer);
      upsertCustomerLocal(saved);
      setSelectedCustomerId(saved.id);
      setIsFormOpen(false);
      await loadLiveData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được khách hàng.");
    } finally {
      setIsSaving(false);
    }
  }

  if (selectedCustomer) {
    return (
      <div className="flex h-full flex-col bg-zinc-50">
        <div className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                aria-label="Quay lại danh sách khách hàng"
                className="mt-1 rounded-[var(--radius-control)] border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">{shortCode(selectedCustomer)}</div>
                <button
                  type="button"
                  onClick={() => setInfoPreview({ title: shortCode(selectedCustomer), content: selectedCustomer.name })}
                  className="block w-full text-left"
                  title={selectedCustomer.name}
                >
                  <h1 className="line-clamp-2 break-words text-2xl font-bold leading-tight text-zinc-900 sm:truncate sm:leading-normal">
                    {selectedCustomer.name}
                  </h1>
                </button>
                <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                  <button
                    type="button"
                    onClick={() => setInfoPreview({ title: "Điện thoại", content: selectedCustomer.phone || "Chưa có SĐT" })}
                    className="inline-flex min-w-0 max-w-full items-center gap-1"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedCustomer.phone || "Chưa có SĐT"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoPreview({ title: "Địa chỉ", content: selectedCustomer.address || "Chưa có địa chỉ" })}
                    className="inline-flex min-w-0 max-w-full items-center gap-1"
                  >
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedCustomer.address || "Chưa có địa chỉ"}</span>
                  </button>
                </div>
              </div>
            </div>
            <Button onClick={() => openEdit(selectedCustomer)} className="w-full lg:w-auto">
              <Edit3 className="mr-2 h-4 w-4" />
              Sửa khách hàng
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-4 sm:gap-3">
            <SummaryCard label="Công nợ hiện tại" value={`${selectedCustomer.oldDebt.toLocaleString()} ₫`} tone="red" />
            <SummaryCard label="Hạn mức nợ" value={`${selectedCustomer.creditLimit.toLocaleString()} ₫`} />
            <SummaryCard label="Doanh số" value={`${selectedRevenue.toLocaleString()} ₫`} tone="green" />
            <SummaryCard label="Đã thu" value={`${selectedPaid.toLocaleString()} ₫`} tone="green" />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200 bg-white p-2 hide-scrollbar sm:mb-5">
            {[
              ["overview", "Tổng quan"],
              ["debt", "Sổ công nợ"],
              ["orders", "Lịch sử mua hàng"],
              ["notes", "Ghi chú"]
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`whitespace-nowrap rounded-[var(--radius-control)] px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Thông tin khách hàng</h2>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <Info label="Mã khách" value={shortCode(selectedCustomer)} onPreview={setInfoPreview} />
                  <Info label="Nhóm khách" value={selectedCustomer.customerGroup || "RETAIL"} onPreview={setInfoPreview} />
                  <Info label="Điện thoại" value={selectedCustomer.phone || "-"} onPreview={setInfoPreview} />
                  <Info label="Địa chỉ" value={selectedCustomer.address || "-"} onPreview={setInfoPreview} />
                </div>
              </section>
              <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Cảnh báo nhanh</h2>
                {selectedCustomer.oldDebt > 0 ? (
                  <div className="rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                    Khách còn nợ {selectedCustomer.oldDebt.toLocaleString()} ₫. Nên theo dõi lịch hẹn thanh toán và tạo nhắc nợ nếu cần.
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Khách chưa có công nợ mở.
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "debt" && (
            <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-lg font-bold text-zinc-900">Sổ công nợ</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-zinc-500">Ngày</th>
                      <th className="px-4 py-3 text-left font-semibold text-zinc-500">Chứng từ</th>
                      <th className="px-4 py-3 text-right font-semibold text-zinc-500">Phát sinh</th>
                      <th className="px-4 py-3 text-right font-semibold text-zinc-500">Đã thu</th>
                      <th className="px-4 py-3 text-right font-semibold text-zinc-500">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {debtLedgerDisplayRows.map((row) => {
                      const order = (row.order_id ? orderByCodeOrId.get(row.order_id) : undefined) ?? (row.source_id ? orderByCodeOrId.get(row.source_id) : undefined);
                      const canOpenOrder = Boolean(order);
                      return (
                      <tr key={row.id} className={canOpenOrder ? "cursor-pointer hover:bg-zinc-50" : "hover:bg-zinc-50"} onClick={() => order && setSelectedOrder(order)}>
                        <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString("vi-VN")}</td>
                        <td className="px-4 py-3">
                          <div className={`font-semibold ${canOpenOrder ? "text-emerald-700 underline decoration-emerald-200 underline-offset-2" : "text-zinc-900"}`}>{ledgerDocument(row)}</div>
                          <div className="mt-0.5 text-xs text-zinc-500">{ledgerTypeLabel(row)}{row.note ? ` · ${row.note}` : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-right">{row.debit > 0 ? `${row.debit.toLocaleString()} ₫` : "-"}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{row.credit > 0 ? `${row.credit.toLocaleString()} ₫` : "-"}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{Math.max(0, row.balance_after).toLocaleString()} ₫</td>
                      </tr>
                    );})}
                    {debtLedgerDisplayRows.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Chưa có giao dịch công nợ.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "orders" && (
            <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900"><Receipt className="h-5 w-5 text-zinc-400" />Lịch sử mua hàng</h2>
              <div className="grid gap-3">
                {selectedOrders.map((order) => (
                  <button key={order.id} type="button" onClick={() => setSelectedOrder(order)} className="rounded-[var(--radius-control)] border border-zinc-200 p-4 text-left hover:bg-zinc-50">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-emerald-700">{order.id}</div>
                        <div className="text-sm text-zinc-500">{new Date(order.date).toLocaleDateString("vi-VN")}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-zinc-900">{order.total.toLocaleString()} ₫</div>
                        <div className="text-sm text-zinc-500">{order.items.length} mặt hàng</div>
                      </div>
                    </div>
                  </button>
                ))}
                {selectedOrders.length === 0 && <div className="rounded-[var(--radius-control)] border border-dashed border-zinc-200 py-10 text-center text-zinc-500">Chưa có đơn hàng.</div>}
              </div>
            </section>
          )}

          {activeTab === "notes" && (
            <section className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900"><StickyNote className="h-5 w-5 text-zinc-400" />Ghi chú và lưu ý</h2>
              <div className="whitespace-pre-wrap rounded-[var(--radius-control)] border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">
                {selectedCustomer.note || "Chưa có ghi chú riêng cho khách hàng này."}
              </div>
            </section>
          )}
        </div>

        <CustomerFormDialog
          form={form}
          isOpen={isFormOpen}
          isSaving={isSaving}
          onClose={() => setIsFormOpen(false)}
          onChange={setForm}
          onSubmit={saveCustomer}
        />
        <InfoPreviewDialog preview={infoPreview} onClose={() => setInfoPreview(null)} />
        <CustomerOrderDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 gap-3 sm:gap-4">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Khách hàng</h1>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Thêm khách hàng
        </Button>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-hidden flex flex-col custom-scrollbar">
        <div className="mb-3 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3">
          <SummaryCard label="Tổng khách hàng" value={String(customers.length)} />
          <SummaryCard label="Khách đang nợ" value={String(debtors.length)} tone="red" />
          <SummaryCard label="Tổng công nợ" value={`${totalDebt.toLocaleString()} ₫`} tone="red" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên, SĐT, mã KH..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="hidden md:flex bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 flex-1 overflow-hidden flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-[960px] w-full table-fixed divide-y divide-zinc-200">
              <colgroup>
                <col className="w-[110px]" />
                <col />
                <col className="w-[170px]" />
                <col className="w-[260px]" />
                <col className="w-[130px]" />
                <col className="w-[120px]" />
                <col className="w-[88px]" />
              </colgroup>
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tên khách hàng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Điện thoại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Địa chỉ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nợ hiện tại</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hạn mức</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setActiveTab("overview");
                    }}
                  >
                    <td className="px-4 py-4 text-xs font-bold text-emerald-600 truncate" title={shortCode(customer)}>{shortCode(customer)}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900 font-bold uppercase truncate" title={customer.name}>{customer.name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-zinc-700">{customer.phone || "-"}</td>
                    <td className="px-4 py-4 text-sm text-zinc-500 truncate" title={customer.address}>{customer.address || "-"}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-right text-red-600">
                      {customer.oldDebt > 0 ? customer.oldDebt.toLocaleString() + " ₫" : "0"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-500 text-right">{customer.creditLimit.toLocaleString()}</td>
                    <td className="px-3 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(customer);
                        }}
                        className="rounded-[var(--radius-control)] p-2 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700"
                        title="Sửa khách hàng"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => {
                setSelectedCustomerId(customer.id);
                setActiveTab("overview");
              }}
              className="bg-white p-3 rounded-[var(--radius-card)] shadow-sm border border-zinc-200 active:scale-[0.98] transition-transform"
            >
              <div className="flex min-w-0 justify-between items-start mb-3 gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedCustomerId(customer.id);
                    }}
                    className="block w-full text-left"
                    title={customer.name}
                  >
                    <h3 className="mb-1 line-clamp-2 break-words text-base font-bold uppercase leading-tight text-zinc-900">{customer.name}</h3>
                  </button>
                  <div className="truncate text-xs font-bold text-emerald-600">{shortCode(customer)}</div>
                </div>
                {customer.oldDebt > 0 && (
                  <div className="max-w-[120px] shrink-0 rounded-[var(--radius-control)] bg-red-50 px-2 py-1 text-right">
                    <div className="text-xs text-red-700 font-semibold mb-0.5">Nợ</div>
                    <div className="truncate text-sm font-bold leading-none text-red-600">{customer.oldDebt.toLocaleString()} ₫</div>
                  </div>
                )}
              </div>
              <div className="space-y-2 mt-4 text-sm text-zinc-600">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setInfoPreview({ title: "Điện thoại", content: customer.phone || "-" });
                  }}
                  className="flex min-w-0 max-w-full items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="truncate">{customer.phone || "-"}</span>
                </button>
                {customer.address && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setInfoPreview({ title: "Địa chỉ", content: customer.address });
                    }}
                    className="flex min-w-0 max-w-full items-start gap-2 text-left"
                  >
                    <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 break-words">{customer.address}</span>
                  </button>
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

      <CustomerFormDialog
        form={form}
        isOpen={isFormOpen}
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onChange={setForm}
        onSubmit={saveCustomer}
      />
      <InfoPreviewDialog preview={infoPreview} onClose={() => setInfoPreview(null)} />
      <CustomerOrderDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}

function CustomerFormDialog({
  form,
  isOpen,
  isSaving,
  onClose,
  onChange,
  onSubmit
}: {
  form: CustomerForm;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onChange: (form: CustomerForm) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={form.id ? "Sửa khách hàng" : "Thêm khách hàng"} className="sm:max-w-2xl">
      <form onSubmit={onSubmit} className="flex flex-col h-full">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mã KH</label>
            <Input value={form.code ?? ""} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="Tự sinh nếu bỏ trống" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nhóm khách</label>
            <Input value={form.customerGroup} onChange={(event) => onChange({ ...form, customerGroup: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tên khách hàng (*)</label>
            <Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Số điện thoại</label>
            <Input type="tel" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Hạn mức nợ</label>
            <Input type="number" value={form.creditLimit || ""} onChange={(event) => onChange({ ...form, creditLimit: Number(event.target.value) || 0 })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Địa chỉ</label>
            <Input value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} />
          </div>
          {form.id && (
            <div className="rounded-[var(--radius-control)] border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-xs font-semibold text-zinc-500">Công nợ hiện tại</div>
              <div className="mt-1 font-bold text-red-600">{form.oldDebt.toLocaleString()} ₫</div>
              <div className="mt-1 text-xs text-zinc-500">Điều chỉnh công nợ tại màn Tài chính để luôn có bút toán đối ứng.</div>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ghi chú / lưu ý</label>
            <textarea
              value={form.note}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
              rows={4}
              className="flex w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
          <Button type="button" onClick={onClose} variant="outline" className="flex-1">Hủy</Button>
          <Button type="submit" disabled={isSaving} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone = "dark" }: { label: string; value: string; tone?: "dark" | "green" | "red" }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-zinc-200 bg-white p-2 shadow-sm sm:p-4">
      <div className="mb-1 line-clamp-2 min-h-[28px] text-[11px] font-medium leading-tight text-zinc-500 sm:mb-2 sm:min-h-0 sm:text-sm">{label}</div>
      <div className={`truncate text-lg font-bold sm:text-2xl ${tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

function Info({
  label,
  value,
  onPreview
}: {
  label: string;
  value: string;
  onPreview: (preview: { title: string; content: string }) => void;
}) {
  return (
    <button type="button" onClick={() => onPreview({ title: label, content: value })} className="min-w-0 text-left">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1 line-clamp-2 break-words font-semibold text-zinc-900">{value}</div>
    </button>
  );
}

function InfoPreviewDialog({
  preview,
  onClose
}: {
  preview: { title: string; content: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog isOpen={Boolean(preview)} onClose={onClose} title={preview?.title ?? "Chi tiết"}>
      <div className="whitespace-pre-wrap break-words rounded-[var(--radius-control)] border border-zinc-100 bg-white p-4 text-sm font-medium leading-6 text-zinc-800">
        {preview?.content}
      </div>
    </Dialog>
  );
}

function CustomerOrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const downloadOrderXlsx = (targetOrder: Order) => {
    void exportSalesOrderXlsx(targetOrder).catch((error) => {
      alert(error instanceof Error ? error.message : "Không xuất được file XLSX.");
    });
  };

  return (
    <Dialog isOpen={Boolean(order)} onClose={onClose} title={`Bill ${order?.id ?? ""}`}>
      {order && (
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4">
            <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Khách hàng</div>
              <div className="mt-1 break-words text-lg font-bold text-zinc-900">{order.customerName}</div>
              <div className="mt-2 text-sm text-zinc-500">{new Date(order.date).toLocaleDateString("vi-VN")}</div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-1">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.id}-${item.name}`} className="flex justify-between gap-3 border-b border-zinc-100 p-3 text-sm last:border-b-0">
                  <div className="min-w-0">
                    <div className="line-clamp-2 break-words font-bold text-zinc-900">{item.name}</div>
                    <div className="mt-1 text-zinc-500">{item.quantity.toLocaleString()} {item.unit} x {item.price.toLocaleString()}</div>
                  </div>
                  <div className="shrink-0 font-bold text-emerald-600">{item.total.toLocaleString()} ₫</div>
                </div>
              ))}
            </div>
            <div className="rounded-[var(--radius-card)] bg-zinc-900 p-4 text-white">
              <div className="flex justify-between text-sm text-zinc-300"><span>Tổng tiền</span><span>{order.total.toLocaleString()} ₫</span></div>
              <div className="mt-2 flex justify-between text-sm text-zinc-300"><span>Đã thu</span><span className="text-emerald-300">{order.paid.toLocaleString()} ₫</span></div>
              <div className="mt-3 flex justify-between border-t border-zinc-700 pt-3 font-bold"><span>Còn nợ</span><span>{Math.max(0, order.total - order.paid).toLocaleString()} ₫</span></div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            <Button onClick={() => downloadOrderXlsx(order)}>Xuất XLSX</Button>
            <Button variant="outline" onClick={() => printSalesOrder(order)}>In bill</Button>
            <Button variant="outline" onClick={() => void shareSalesOrderImage(order)}>Share ảnh</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
