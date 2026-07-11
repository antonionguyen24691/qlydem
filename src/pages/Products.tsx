import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ClipboardList, Download, Edit3, Filter, Package, Plus, ShoppingCart, Trash2, Upload, XCircle, Search } from "lucide-react";
import { useDataStore, Product } from "../store/data";
import { usePOSStore } from "../store/pos";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getAuthHeaders } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { canEditSalePrices, canManageProducts, canSell, isAdmin } from "../lib/permissions";

type ProductForm = {
  id?: string;
  code: string;
  name: string;
  invoiceName: string;
  productType: string;
  category: string;
  unit: string;
  size: string;
  price: number;
  cost: number;
  stock: number;
  m2PerBox: number;
  piecesPerBox: number;
  priceByM2: number;
  vatRate: number;
  status: string;
  lifecycleStatus: string;
};

const emptyForm: ProductForm = {
  code: "",
  name: "",
  invoiceName: "",
  productType: "MERCHANDISE",
  category: "",
  unit: "HỘP",
  size: "",
  price: 0,
  cost: 0,
  stock: 0,
  m2PerBox: 0,
  piecesPerBox: 0,
  priceByM2: 0,
  vatRate: 0,
  status: "ACTIVE",
  lifecycleStatus: "ACTIVE"
};

const defaultUnitOptions = [
  { code: "HỘP", name: "Hộp" },
  { code: "VIÊN", name: "Viên" },
  { code: "M2", name: "Mét vuông" }
];

type PriceSheetRow = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  cost: number;
  currentPrice: number;
  newPrice: number;
  note: string;
};

type PriceUpdateRequest = {
  id: string;
  status: string;
  note?: string;
  created_at?: string;
  items: Array<{
    id: string;
    old_sell_price: number;
    new_sell_price: number;
    old_cost_price: number;
    note?: string;
    products?: {
      code?: string;
      product_name?: string;
      unit?: string;
    };
  }>;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function toForm(product?: Product): ProductForm {
  if (!product) return { ...emptyForm };
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    invoiceName: product.invoiceName ?? "",
    productType: product.productType ?? "MERCHANDISE",
    category: product.category ?? "",
    unit: product.unit ?? "HỘP",
    size: product.size ?? "",
    price: product.price ?? 0,
    cost: product.cost ?? 0,
    stock: product.stock ?? 0,
    m2PerBox: product.m2PerBox ?? 0,
    piecesPerBox: product.piecesPerBox ?? 0,
    priceByM2: product.priceByM2 ?? 0,
    vatRate: product.vatRate ?? 0,
    status: product.status ?? "ACTIVE",
    lifecycleStatus: product.lifecycleStatus ?? "ACTIVE"
  };
}

function mapSavedProduct(row: any, currentStock = 0): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.product_name ?? row.invoice_name ?? row.code,
    invoiceName: row.invoice_name ?? "",
    productType: row.product_type ?? "",
    category: row.category ?? row.product_type ?? "",
    size: row.size ?? "",
    unit: row.unit ?? "",
    stock: currentStock,
    price: Number(row.sell_price_box_vat ?? row.price_by_m2 ?? 0),
    cost: Number(row.cost_price ?? 0),
    m2PerBox: Number(row.m2_per_box ?? 0),
    piecesPerBox: Number(row.pieces_per_box ?? 0),
    priceByM2: Number(row.price_by_m2 ?? 0),
    vatRate: Number(row.vat_rate ?? 0),
    status: row.status ?? "ACTIVE",
    lifecycleStatus: row.lifecycle_status ?? "ACTIVE"
  };
}

export function Products() {
  const { products, orders, upsertProductLocal, loadLiveData } = useDataStore();
  const addToCart = usePOSStore((state) => state.addToCart);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const canManage = canManageProducts(user);
  const canEditPrices = canEditSalePrices(user);
  const canApprovePrices = isAdmin(user);
  const canUseSales = canSell(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitOptions, setUnitOptions] = useState(defaultUnitOptions);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const selectedUnitLabel = unitOptions.find((unit) => unit.code === form.unit)?.name ?? form.unit ?? "ĐVT chính";
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);
  const [priceRows, setPriceRows] = useState<PriceSheetRow[]>([]);
  const [priceNote, setPriceNote] = useState("");
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [isExportingPrices, setIsExportingPrices] = useState(false);
  const [isImportingPrices, setIsImportingPrices] = useState(false);
  const [priceRequests, setPriceRequests] = useState<PriceUpdateRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch("/api/settings?key=units", { headers: await getAuthHeaders() });
        const body = await response.json();
        const units = Array.isArray(body?.units?.units) ? body.units.units : [];
        const normalized = units
          .map((unit: any) => ({
            code: String(unit.code ?? "").trim(),
            name: String(unit.name ?? unit.code ?? "").trim()
          }))
          .filter((unit: { code: string; name: string }) => unit.code && unit.name);
        if (mounted && normalized.length > 0) setUnitOptions(normalized);
      } catch {
        if (mounted) setUnitOptions(defaultUnitOptions);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort();
  }, [products]);

  const productTypes = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.productType).filter(Boolean))).sort();
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const term = normalizeSearch(searchTerm);
    const inactive = product.status === "INACTIVE" || product.lifecycleStatus === "DISCONTINUED";
    const matchSearch =
      !term ||
      [product.name, product.code, product.invoiceName ?? "", product.category ?? "", product.size ?? ""]
        .some((value) => normalizeSearch(value).includes(term));
    const matchCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchType = typeFilter === "all" || product.productType === typeFilter;
    const matchStock =
      stockFilter === "all" ||
      (stockFilter === "in_stock" && product.stock > 0) ||
      (stockFilter === "out_stock" && product.stock <= 0) ||
      (stockFilter === "low_stock" && product.stock > 0 && product.stock <= 10);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !inactive) ||
      (statusFilter === "inactive" && inactive);
    return matchSearch && matchCategory && matchType && matchStock && matchStatus;
  });

  const activeFilterCount = [
    categoryFilter !== "all",
    typeFilter !== "all",
    stockFilter !== "all",
    statusFilter !== "all"
  ].filter(Boolean).length;

  const selectedProductStats = useMemo(() => {
    if (!selectedProduct) return null;
    const matchedOrders = orders
      .map((order) => ({
        order,
        items: order.items.filter((item) => item.id === selectedProduct.id || item.id === selectedProduct.code || item.name === selectedProduct.name)
      }))
      .filter((entry) => entry.items.length > 0);
    const quantity = matchedOrders.reduce((sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const revenue = matchedOrders.reduce((sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + item.total, 0), 0);
    const latest = matchedOrders
      .map((entry) => entry.order)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return { orderCount: matchedOrders.length, quantity, revenue, latest };
  }, [orders, selectedProduct]);

  function resetProductFilters() {
    setCategoryFilter("all");
    setTypeFilter("all");
    setStockFilter("all");
    setStatusFilter("all");
  }

  function buildPriceRows(sourceProducts = products) {
    return sourceProducts
      .filter((product) => product.status !== "INACTIVE" && product.lifecycleStatus !== "DISCONTINUED")
      .map((product) => ({
        productId: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        cost: product.cost,
        currentPrice: product.price,
        newPrice: product.price,
        note: ""
      }));
  }

  async function loadPriceRequests() {
    if (!canEditPrices) return;
    try {
      const response = await fetch("/api/data/price-update-requests", {
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được lệnh giá bán.");
      setPriceRequests(body.requests ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không tải được lệnh giá bán.");
    }
  }

  async function openPriceSheet() {
    setPriceRows(buildPriceRows(products));
    setPriceNote("");
    setMessage("");
    setErrorMessage("");
    setIsPriceSheetOpen(true);
    await loadPriceRequests();
  }

  function updatePriceRow(productId: string, patch: Partial<PriceSheetRow>) {
    setPriceRows((rows) => rows.map((row) => row.productId === productId ? { ...row, ...patch } : row));
  }

  async function savePriceSheet() {
    const changedRows = priceRows.filter((row) => row.newPrice !== row.currentPrice);
    if (changedRows.length === 0) {
      setMessage("Bảng giá không có thay đổi.");
      return;
    }

    setIsSavingPrices(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/data/price-update-sheet", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          note: priceNote,
          rows: changedRows.map((row) => ({
            productId: row.productId,
            newPrice: row.newPrice,
            note: row.note
          }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được bảng giá.");
      setMessage(body.status === "PENDING_APPROVAL" ? `Đã gửi ${body.changedRows} dòng chờ admin duyệt.` : `Đã cập nhật ${body.changedRows} dòng giá bán.`);
      await loadLiveData();
      setPriceRows(buildPriceRows(products));
      await loadPriceRequests();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không lưu được bảng giá.");
    } finally {
      setIsSavingPrices(false);
    }
  }

  async function reviewPriceRequest(requestId: string, decision: "APPROVE" | "REJECT") {
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/data/price-update-requests", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({ requestId, decision })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không duyệt được lệnh giá.");
      setMessage(decision === "APPROVE" ? `Đã duyệt ${body.changedRows ?? 0} dòng giá bán.` : "Đã từ chối lệnh giá bán.");
      await loadLiveData();
      setPriceRows(buildPriceRows(products));
      await loadPriceRequests();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không duyệt được lệnh giá.");
    }
  }

  async function exportPriceList() {
    setIsExportingPrices(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/export/price-list", {
        headers: await getAuthHeaders()
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Không xuất được bảng giá.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pmql-bang-gia-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không xuất được bảng giá.");
    } finally {
      setIsExportingPrices(false);
    }
  }

  async function importPriceList(file?: File) {
    if (!file) return;
    setIsImportingPrices(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/import/price-list", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "x-file-name": encodeURIComponent(file.name)
        },
        body: await file.arrayBuffer()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không nhập được bảng giá.");
      setMessage(body.status === "PENDING_APPROVAL"
        ? `Đã nhập ${body.successRows} dòng giá và gửi chờ duyệt.${body.skippedUnitRows ? ` ${body.skippedUnitRows} đơn vị tính cần Admin cập nhật.` : ""}`
        : body.skippedUnitRows
          ? `${body.skippedUnitRows} đơn vị tính cần Admin cập nhật.`
          : `Đã cập nhật ${body.updatedPriceRows ?? 0} giá, ${body.updatedUnitRows ?? 0} đơn vị tính.`);
      await loadLiveData();
      setPriceRows(buildPriceRows(products));
      await loadPriceRequests();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không nhập được bảng giá.");
    } finally {
      setIsImportingPrices(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setIsCustomUnit(false);
    setIsFormOpen(true);
  }

  function openEdit(product: Product) {
    setForm(toForm(product));
    setIsCustomUnit(false);
    setIsFormOpen(true);
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      alert("Vui lòng nhập mã và tên hàng hóa.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/data/products", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          productName: form.name
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được hàng hóa.");
      upsertProductLocal(mapSavedProduct(body.product, form.stock));
      setIsFormOpen(false);
      await loadLiveData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được hàng hóa.");
    } finally {
      setIsSaving(false);
    }
  }

  async function discontinueProduct(product: Product) {
    if (!window.confirm(`Ngưng bán mã hàng ${product.code}? Mã này sẽ được giữ lịch sử nhưng không dùng như hàng đang bán.`)) return;
    try {
      const response = await fetch("/api/data/products", {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({ id: product.id, reason: "Ngưng bán từ danh mục hàng hóa" })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không ngưng bán được hàng hóa.");
      upsertProductLocal(mapSavedProduct(body.product, product.stock));
      await loadLiveData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không ngưng bán được hàng hóa.");
    }
  }

  function sellProduct(product: Product) {
    addToCart(product);
    navigate("/pos");
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex items-center justify-end border-b border-zinc-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          {canEditPrices && (
            <Button onClick={openPriceSheet} variant="outline" className="w-full sm:w-auto">
              <ClipboardList className="h-4 w-4 mr-2" />
              Bảng giá
            </Button>
          )}
          {canManage && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Thêm hàng hóa
            </Button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-6 flex-1 overflow-hidden flex flex-col">
        {errorMessage && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMessage}</div>}
        {message && <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}
        <div className="flex items-center gap-2 mb-3 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm kiếm theo mã, tên hàng..."
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="h-11 w-11 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-3" onClick={() => setIsFilterOpen(true)} title="Bộ lọc" aria-label="Bộ lọc hàng hóa">
            <Filter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500 sm:mb-4">
          <span className="font-medium">{filteredProducts.length} hàng hóa</span>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetProductFilters} className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
              Xóa lọc
            </button>
          )}
        </div>

        <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 overflow-hidden flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-[1080px] w-full table-fixed divide-y divide-zinc-200">
              <colgroup>
                <col className="w-[130px]" />
                <col />
                <col className="w-[150px]" />
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[90px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tên hàng hóa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Danh mục</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">ĐVT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Giá vốn</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Giá bán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tồn</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredProducts.map((product) => {
                  const inactive = product.status === "INACTIVE" || product.lifecycleStatus === "DISCONTINUED";
                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-zinc-50 cursor-pointer transition-colors ${inactive ? "opacity-55" : ""}`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 truncate" title={product.code}>{product.code}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 font-medium">
                        <div className="line-clamp-2" title={product.name}>{product.name}</div>
                        <div className="mt-1 flex gap-2 text-xs text-zinc-500">
                          {product.size && <span>{product.size}</span>}
                          {inactive && <span className="font-bold text-red-600">Ngưng bán</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 truncate">{product.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 text-center">{product.unit}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 text-right">{product.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-zinc-900 text-right">{product.price.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.stock <= 0 ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10" : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="inline-flex justify-end gap-1">
                          {canUseSales && !inactive && (
                            <button type="button" onClick={() => sellProduct(product)} className="rounded-lg p-2 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700" title="Đưa vào bán hàng">
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button type="button" onClick={() => openEdit(product)} className="rounded-lg p-2 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700" title="Sửa hàng hóa">
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && !inactive && (
                            <button type="button" onClick={() => discontinueProduct(product)} className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-700" title="Ngưng bán">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden flex-1 overflow-y-auto space-y-3 custom-scrollbar pb-20">
          {filteredProducts.map((product) => {
            const inactive = product.status === "INACTIVE" || product.lifecycleStatus === "DISCONTINUED";
            return (
              <div key={product.id} onClick={() => setSelectedProduct(product)} className={`bg-white p-3 rounded-xl shadow-sm border border-zinc-200 active:scale-[0.98] transition-transform ${inactive ? "opacity-60" : ""}`}>
                <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 break-words text-base font-semibold text-zinc-900">{product.name}</h3>
                    <div className="mt-0.5 truncate text-sm font-medium text-emerald-600">{product.code}</div>
                  </div>
                  <span className={`inline-flex max-w-[104px] shrink-0 items-center truncate px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.stock <= 0 ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10" : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                  }`}>
                    Tồn: {product.stock}
                  </span>
                </div>
                <div className="mt-3 flex min-w-0 justify-between gap-3">
                  <div className="min-w-0 text-sm text-zinc-500">
                    {product.category && <span className="mr-2 inline-block max-w-[150px] truncate align-bottom">{product.category}</span>}
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-xs">{product.unit}</span>
                  </div>
                  <div className="min-w-0 shrink-0 text-right">
                    <div className="max-w-[150px] truncate text-lg font-bold leading-none text-zinc-900">{product.price.toLocaleString()} đ</div>
                    {inactive && <div className="mt-1 text-xs font-bold text-red-600">Ngưng bán</div>}
                  </div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-3" onClick={(event) => event.stopPropagation()}>
                  {canUseSales && !inactive && <Button variant="outline" className="flex-1" onClick={() => sellProduct(product)}>Bán</Button>}
                  {canManage && <Button variant="outline" className="flex-1" onClick={() => openEdit(product)}>Sửa</Button>}
                  {canManage && !inactive && <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => discontinueProduct(product)}>Ngưng</Button>}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Package className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>Không tìm thấy sản phẩm nào</p>
            </div>
          )}
        </div>
      </div>

      <Dialog isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Bộ lọc hàng hóa" className="sm:max-w-2xl">
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <Field label="Danh mục">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10">
                <option value="all">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Loại hàng">
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10">
                <option value="all">Tất cả loại hàng</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Tồn kho">
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10">
                <option value="all">Tất cả tồn kho</option>
                <option value="in_stock">Còn hàng</option>
                <option value="low_stock">Sắp hết hàng</option>
                <option value="out_stock">Hết hàng</option>
              </select>
            </Field>
            <Field label="Trạng thái">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10">
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang bán</option>
                <option value="inactive">Ngưng bán</option>
              </select>
            </Field>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Kết quả</div>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{filteredProducts.length.toLocaleString()} hàng hóa</div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
            <Button type="button" variant="outline" onClick={resetProductFilters}>
              Đặt lại
            </Button>
            <Button type="button" onClick={() => setIsFilterOpen(false)}>
              Áp dụng
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} title="Chi tiết hàng hóa">
        {selectedProduct && (
          <div className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <div className="text-sm text-zinc-500 mb-1">Mã hàng</div>
                <div className="break-words text-lg font-bold text-emerald-600">{selectedProduct.code}</div>
                <div className="mt-4 text-sm text-zinc-500 mb-1">Tên hàng hóa</div>
                <div className="break-words text-xl font-bold text-zinc-900">{selectedProduct.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Danh mục" value={selectedProduct.category || "-"} />
                <Info label="Đơn vị tính" value={selectedProduct.unit || "-"} />
                <Info label="Quy cách" value={selectedProduct.size || "-"} />
                <Info label="Trạng thái" value={selectedProduct.status || "ACTIVE"} />
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-zinc-200 pt-6">
                <Price label="Giá vốn" value={selectedProduct.cost} />
                <Price label="Giá bán" value={selectedProduct.price} tone="green" />
                <div>
                  <span className="text-zinc-500 text-sm block mb-1">Tồn kho</span>
                  <div className={`truncate text-xl font-bold ${selectedProduct.stock <= 0 ? "text-red-600" : "text-emerald-600"}`}>{selectedProduct.stock.toLocaleString()}</div>
                </div>
              </div>
              {selectedProductStats && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-500">Bán hàng</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniStat label="Số đơn" value={selectedProductStats.orderCount.toLocaleString()} />
                    <MiniStat label="SL đã bán" value={selectedProductStats.quantity.toLocaleString()} />
                    <MiniStat label="Doanh số" value={`${selectedProductStats.revenue.toLocaleString()} đ`} />
                    <MiniStat label="Lần gần nhất" value={selectedProductStats.latest ? new Date(selectedProductStats.latest.date).toLocaleDateString("vi-VN") : "-"} />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {canManage && <Button onClick={() => { openEdit(selectedProduct); setSelectedProduct(null); }}>Sửa</Button>}
              <Button onClick={() => setSelectedProduct(null)} variant="outline" className={!canManage ? "col-span-2" : ""}>Đóng</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isPriceSheetOpen} onClose={() => setIsPriceSheetOpen(false)} title="Bảng giá bán" className="sm:max-w-5xl">
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:flex sm:items-center">
            <Input value={priceNote} onChange={(event) => setPriceNote(event.target.value)} placeholder="Ghi chú đợt giá..." />
            <Button type="button" variant="outline" onClick={exportPriceList} disabled={isExportingPrices} className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3" title="Xuất XLSX" aria-label="Xuất XLSX">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{isExportingPrices ? "Đang xuất..." : "Xuất XLSX"}</span>
            </Button>
            <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 sm:h-10 sm:w-auto sm:px-3" title="Nhập XLSX">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden text-sm font-semibold sm:inline">{isImportingPrices ? "Đang nhập..." : "Nhập XLSX"}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={isImportingPrices}
                  onChange={(event) => {
                    void importPriceList(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          <div className="space-y-2 md:hidden">
            {priceRows.map((row) => {
              const changed = row.newPrice !== row.currentPrice;
              return (
                <div key={row.productId} className={`rounded-lg border p-3 ${changed ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="font-semibold text-emerald-700">{row.code}</div><div className="line-clamp-2 text-sm font-semibold text-zinc-900">{row.name}</div></div>
                    <span className="shrink-0 text-xs font-medium text-zinc-500">{row.unit}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><div className="text-xs text-zinc-500">Hiện tại<br /><span className="font-semibold text-zinc-700">{row.currentPrice.toLocaleString()} đ</span></div><Input type="number" value={row.newPrice || ""} onChange={(event) => updatePriceRow(row.productId, { newPrice: Number(event.target.value) || 0 })} className="h-10 text-right font-semibold" aria-label={`Giá bán mới ${row.code}`} /></div>
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left">Mã</th>
                  <th className="px-4 py-3 text-left">Hàng hóa</th>
                  <th className="px-4 py-3 text-center">ĐVT</th>
                  <th className="px-4 py-3 text-right">Giá vốn</th>
                  <th className="px-4 py-3 text-right">Giá bán hiện tại</th>
                  <th className="px-4 py-3 text-right">Giá bán mới</th>
                  <th className="px-4 py-3 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {priceRows.map((row) => {
                  const changed = row.newPrice !== row.currentPrice;
                  return (
                    <tr key={row.productId} className={changed ? "bg-emerald-50/40" : undefined}>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{row.code}</td>
                      <td className="px-4 py-3"><div className="line-clamp-2 font-semibold text-zinc-900">{row.name}</div></td>
                      <td className="px-4 py-3 text-center text-zinc-500">{row.unit}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{row.cost.toLocaleString()} đ</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-700">{row.currentPrice.toLocaleString()} đ</td>
                      <td className="px-4 py-3">
                        <Input type="number" value={row.newPrice || ""} onChange={(event) => updatePriceRow(row.productId, { newPrice: Number(event.target.value) || 0 })} className="text-right font-semibold" />
                      </td>
                      <td className="px-4 py-3">
                        <Input value={row.note} onChange={(event) => updatePriceRow(row.productId, { note: event.target.value })} placeholder="Lý do..." />
                      </td>
                    </tr>
                  );
                })}
                {priceRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Chưa có hàng hóa để chỉnh giá.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-between">
            <div className="text-sm text-zinc-500">{priceRows.filter((row) => row.newPrice !== row.currentPrice).length} dòng đang thay đổi</div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Button type="button" variant="outline" onClick={() => setIsPriceSheetOpen(false)}>Đóng</Button>
              <Button type="button" onClick={savePriceSheet} disabled={isSavingPrices}>{isSavingPrices ? "Đang lưu..." : canApprovePrices ? "Lưu bảng giá" : "Gửi duyệt"}</Button>
            </div>
          </div>
          {canApprovePrices && (
            <section className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <div>
                  <h3 className="font-bold text-zinc-900">Lệnh giá chờ duyệt</h3>
                  <p className="text-sm text-zinc-500">Duyệt các thay đổi do kế toán gửi lên.</p>
                </div>
                <Button type="button" variant="outline" onClick={loadPriceRequests}>Tải lại</Button>
              </div>
              <div className="divide-y divide-zinc-100">
                {priceRequests.filter((request) => request.status === "PENDING").map((request) => (
                  <div key={request.id} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-semibold text-zinc-900">{request.items.length} dòng giá bán</div>
                        <div className="text-sm text-zinc-500">{request.note || "Không có ghi chú"} • {request.created_at ? new Date(request.created_at).toLocaleString("vi-VN") : ""}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => reviewPriceRequest(request.id, "REJECT")}><XCircle className="mr-2 h-4 w-4" />Từ chối</Button>
                        <Button type="button" onClick={() => reviewPriceRequest(request.id, "APPROVE")}><CheckCircle className="mr-2 h-4 w-4" />Duyệt</Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {request.items.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
                          <div className="font-semibold text-zinc-900">{item.products?.code} - {item.products?.product_name}</div>
                          <div className="text-zinc-500">{Number(item.old_sell_price ?? 0).toLocaleString()} đ -&gt; <span className="font-semibold text-emerald-700">{Number(item.new_sell_price ?? 0).toLocaleString()} đ</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {priceRequests.filter((request) => request.status === "PENDING").length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-zinc-500">Không có lệnh giá nào đang chờ duyệt.</div>
                )}
              </div>
            </section>
          )}
        </div>
      </Dialog>

      <Dialog isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={form.id ? "Sửa hàng hóa" : "Thêm hàng hóa"} className="sm:max-w-3xl">
        <form onSubmit={saveProduct} className="flex flex-col h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mã hàng (*)"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></Field>
            <Field label="Danh mục"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
            <Field label="Tên hàng hóa (*)" className="sm:col-span-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Tên trên hóa đơn" className="sm:col-span-2"><Input value={form.invoiceName} onChange={(event) => setForm({ ...form, invoiceName: event.target.value })} /></Field>
            <Field label="Loại hàng"><Input value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value })} /></Field>
            <Field label="Đơn vị tính">
              {isCustomUnit ? (
                <Input
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value.toUpperCase() })}
                  placeholder="HỘP, CÁI, KG, THÙNG..."
                  className="uppercase"
                />
              ) : (
                <select
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:h-10 sm:text-sm"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit.code} value={unit.code}>{unit.name} ({unit.code})</option>
                  ))}
                  {form.unit && !unitOptions.some((unit) => unit.code === form.unit) && <option value={form.unit}>{form.unit}</option>}
                </select>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomUnit((current) => !current)}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {isCustomUnit ? "Chọn từ danh sách" : "Nhập ĐVT khác"}
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => navigate("/settings?section=units")}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Cấu hình danh sách đơn vị
                  </button>
                )}
              </div>
            </Field>
            <Field label="Quy cách"><Input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></Field>
            <Field label="Tồn mở đầu"><Input type="number" value={form.stock || ""} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) || 0 })} /></Field>
            <Field label="Giá vốn"><Input type="number" value={form.cost || ""} onChange={(event) => setForm({ ...form, cost: Number(event.target.value) || 0 })} /></Field>
            <Field label="Giá bán"><Input type="number" value={form.price || ""} onChange={(event) => setForm({ ...form, price: Number(event.target.value) || 0 })} /></Field>
            <Field label={`Quy đổi diện tích/${selectedUnitLabel}`}><Input type="number" value={form.m2PerBox || ""} onChange={(event) => setForm({ ...form, m2PerBox: Number(event.target.value) || 0 })} /></Field>
            <Field label={`Quy đổi số lượng lẻ/${selectedUnitLabel}`}><Input type="number" value={form.piecesPerBox || ""} onChange={(event) => setForm({ ...form, piecesPerBox: Number(event.target.value) || 0 })} /></Field>
            <Field label="Trạng thái"><Input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></Field>
            <Field label="Vòng đời"><Input value={form.lifecycleStatus} onChange={(event) => setForm({ ...form, lifecycleStatus: event.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button type="button" onClick={() => setIsFormOpen(false)} variant="outline">Hủy</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Đang lưu..." : "Lưu hàng hóa"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500 block mb-1">{label}</span>
      <div className="break-words font-medium text-zinc-900">{value}</div>
    </div>
  );
}

function Price({ label, value, tone = "dark" }: { label: string; value: number; tone?: "green" | "dark" }) {
  return (
    <div>
      <span className="text-zinc-500 text-sm block mb-1">{label}</span>
      <div className={`font-bold text-xl ${tone === "green" ? "text-emerald-600" : "text-zinc-900"}`}>{value.toLocaleString()} đ</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-50 p-3">
      <div className="truncate text-xs font-bold text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-base font-black text-zinc-900">{value}</div>
    </div>
  );
}
