import { useEffect, useMemo, useState } from "react";
import { useDataStore, Product } from "../store/data";
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, ChevronUp, ClipboardCheck, Plus, RefreshCw, Search, Send, X, PackageSearch } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { InventoryReceiptDialog } from "../components/inventory/InventoryReceiptDialog";
import { useAuthStore } from "../store/auth";
import { canCountInventory, canManageInventory, canRequestStockOut, isAdmin } from "../lib/permissions";
import { getAuthHeaders } from "../lib/supabase";

type InventoryMode = "IN" | "OUT" | "COUNT" | "REQUEST_EXPORT";

const MODE_LABEL: Record<InventoryMode, string> = {
  IN: "Nhập kho",
  OUT: "Xuất kho",
  COUNT: "Kiểm kê",
  REQUEST_EXPORT: "Đề nghị xuất kho"
};

type CountRow = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  quantity: number;
  note: string;
};

type ApprovalRequest = {
  id: string;
  status: string;
  note?: string;
  created_at: string;
  items: Array<{
    id: string;
    old_quantity_box: number;
    new_quantity_box: number;
    quantity_change: number;
    note?: string;
    products?: {
      code?: string;
      product_name?: string;
      unit?: string;
    };
  }>;
};

type SupplierRow = {
  id: string;
  code?: string;
  name: string;
  phone?: string;
};

type InventoryTransactionRow = {
  id: string;
  product_id: string;
  source_type: string;
  quantity_change: number;
  stock_after: number;
  note?: string;
  created_at: string;
};

type InventoryOperation = {
  code: string;
  name: string;
  direction: "IN" | "OUT" | "COUNT";
  costingMethod?: string;
};

const defaultInventoryOperations: InventoryOperation[] = [
  { code: "PURCHASE_IN", name: "Nhập mua hàng", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
  { code: "RETURN_IN", name: "Nhập hàng trả lại", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
  { code: "SALE_OUT", name: "Xuất bán hàng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
  { code: "DAMAGE_OUT", name: "Xuất hao hụt/hư hỏng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
  { code: "STOCK_COUNT", name: "Kiểm kê điều chỉnh", direction: "COUNT", costingMethod: "WEIGHTED_AVERAGE" }
];

export function Inventory() {
  const { products, loadLiveData } = useDataStore();
  const user = useAuthStore((state) => state.user);
  const canAdjust = canManageInventory(user);
  const canCount = canCountInventory(user);
  const canApproveInventory = isAdmin(user);
  const canRequest = canRequestStockOut(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [mode, setMode] = useState<InventoryMode>("IN");
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [infoPreview, setInfoPreview] = useState<{ title: string; content: string } | null>(null);
  const [countRows, setCountRows] = useState<CountRow[]>([]);
  const [isCountMode, setIsCountMode] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionRow[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isInventorySummaryOpen, setIsInventorySummaryOpen] = useState(false);
  const [isInventoryActionsOpen, setIsInventoryActionsOpen] = useState(false);
  const [receiptInitialProductId, setReceiptInitialProductId] = useState<string | undefined>();
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(20);
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "LOW" | "AVAILABLE">("ALL");
  const [inventoryOperations, setInventoryOperations] = useState<InventoryOperation[]>(defaultInventoryOperations);
  const [supplierId, setSupplierId] = useState("");
  const [documentCode, setDocumentCode] = useState("");
  const [operationType, setOperationType] = useState("PURCHASE_IN");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitCost, setUnitCost] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    code: "",
    name: "",
    category: "",
    unit: "HỘP",
    size: "",
    salePrice: 0
  });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const supplierResponse = await fetch("/api/data/suppliers", { headers: await getAuthHeaders() });
        const body = await supplierResponse.json();
        if (mounted && supplierResponse.ok && body.ok) setSuppliers(body.rows ?? []);
      } catch {
        if (mounted) setSuppliers([]);
      }
      try {
        const transactionResponse = await fetch("/api/data/inventory_transactions", { headers: await getAuthHeaders() });
        const body = await transactionResponse.json();
        if (mounted && transactionResponse.ok && body.ok) setTransactions(body.rows ?? []);
      } catch {
        if (mounted) setTransactions([]);
      }
      try {
        const operationResponse = await fetch("/api/settings?key=inventoryOperations", { headers: await getAuthHeaders() });
        const body = await operationResponse.json();
        const operations = body?.inventoryOperations?.operations;
        if (mounted && Array.isArray(operations) && operations.length > 0) setInventoryOperations(operations);
      } catch {
        if (mounted) setInventoryOperations(defaultInventoryOperations);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stockInTotal = Math.max(0, quantity * unitCost - discountAmount + vatAmount);
  const stockInPayable = Math.max(0, stockInTotal - paidAmount);

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term);
    const minimum = product.minStockLevel ?? 0;
    const matchesStatus = stockStatusFilter === "ALL" || (stockStatusFilter === "LOW" ? product.stock <= minimum : product.stock > minimum);
    return matchesSearch && matchesStatus;
  });

  const lowStock = products.filter((product) => product.stock <= 0);
  const nearLowStock = products.filter((product) => product.stock > 0 && product.stock <= (product.minStockLevel ?? 0));
  const inventoryWarnings = [...lowStock, ...nearLowStock].slice(0, 8);
  const totalValue = products.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const inventoryByCategory = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const product of products) {
      const category = product.category || "Khác";
      const current = map.get(category) ?? { count: 0, value: 0 };
      map.set(category, { count: current.count + 1, value: current.value + (product.stock * product.cost) });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value).slice(0, 6);
  }, [products]);
  const stockTotalPages = Math.max(1, Math.ceil(filteredProducts.length / stockPageSize));
  const pagedProducts = filteredProducts.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize);

  const countVisibleRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return countRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term));
  }, [countRows, searchTerm]);

  const countChangedRows = useMemo(() => {
    return countRows.filter((row) => Number(row.quantity) !== Number(row.currentStock));
  }, [countRows]);

  const startCountMode = () => {
    if (!canCount) return;
    setMode("COUNT");
    setSelectedProduct(null);
    setNote("");
    setCountRows(products.map((item) => ({
      productId: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      currentStock: item.stock,
      quantity: item.stock,
      note: ""
    })));
    setIsCountMode(true);
  };

  const updateCountRow = (index: number, patch: Partial<CountRow>) => {
    setCountRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const openAdjust = (nextMode: InventoryMode, product?: Product) => {
    if (nextMode === "COUNT" ? !canCount : nextMode === "REQUEST_EXPORT" ? !canRequest : !canAdjust) return;
    if (nextMode === "COUNT") {
      startCountMode();
      return;
    }
    setMode(nextMode);
    setSelectedProduct(product ?? null);
    setQuantity(0);
    setNote("");
    setSupplierId("");
    setDocumentCode("");
    setOperationType(
      nextMode === "IN"
        ? (inventoryOperations.find((item) => item.direction === "IN")?.code ?? "PURCHASE_IN")
        : (inventoryOperations.find((item) => item.direction === "OUT")?.code ?? "SALE_OUT")
    );
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setUnitCost(nextMode === "IN" ? Number(product?.cost ?? 0) : 0);
    setDiscountAmount(0);
    setVatAmount(0);
    setPaidAmount(0);
    setIsCreatingProduct(false);
    setNewProduct({ code: "", name: "", category: "", unit: "HỘP", size: "", salePrice: 0 });
    setIsAdjustOpen(true);
  };

  const openReceipt = (product?: Product) => {
    setReceiptInitialProductId(product?.id);
    setIsReceiptOpen(true);
  };

  const reloadInventory = async () => {
    await loadLiveData();
    try {
      const response = await fetch("/api/data/inventory_transactions", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (response.ok && body.ok) setTransactions(body.rows ?? []);
    } catch {
      setTransactions([]);
    }
  };

  const saveCountSheet = async () => {
    const changedRows = countChangedRows;
    if (changedRows.length === 0) {
      alert("Chưa có dòng nào thay đổi tồn kho.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/data/inventory-count-sheet", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          warehouseCode: "KHO-CHINH",
          note,
          rows: changedRows.map((row) => ({
            productId: row.productId,
            quantity: Number(row.quantity) || 0,
            note: row.note
          }))
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được kiểm kê sheet.");
      if (body.status === "PENDING_APPROVAL") {
        alert(`Đã gửi ${body.changedRows} dòng kiểm kê chờ admin duyệt.`);
      } else {
        alert(`Đã lưu kiểm kê ${body.changedRows} dòng.`);
        await loadLiveData();
      }
      setIsCountMode(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được kiểm kê sheet.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAdjustment = async () => {
    if (mode === "COUNT") {
      await saveCountSheet();
      return;
    }
    if (mode === "IN" && isCreatingProduct && (!newProduct.code.trim() || !newProduct.name.trim())) {
      alert("Vui lòng nhập mã hàng và tên hàng hóa mới.");
      return;
    }
    if (!selectedProduct && !(mode === "IN" && isCreatingProduct)) {
      alert("Vui lòng chọn sản phẩm.");
      return;
    }
    if (quantity <= 0 && mode !== "COUNT") {
      alert("Số lượng phải lớn hơn 0.");
      return;
    }
    setIsSaving(true);
    try {
      let productForAdjustment = selectedProduct;
      if (mode === "IN" && isCreatingProduct) {
        const productResponse = await fetch("/api/data/products", {
          method: "POST",
          headers: {
            ...(await getAuthHeaders()),
            "content-type": "application/json"
          },
          body: JSON.stringify({
            code: newProduct.code,
            productName: newProduct.name,
            invoiceName: newProduct.name,
            category: newProduct.category,
            unit: newProduct.unit,
            size: newProduct.size,
            cost: unitCost,
            price: newProduct.salePrice,
            stock: 0,
            warehouseCode: "KHO-CHINH"
          })
        });
        const productBody = await productResponse.json();
        if (!productResponse.ok || !productBody.ok) throw new Error(productBody.error ?? "Không tạo được hàng hóa mới");
        productForAdjustment = {
          id: productBody.product.id,
          code: productBody.product.code,
          name: productBody.product.product_name,
          invoiceName: productBody.product.invoice_name,
          productType: productBody.product.product_type,
          category: productBody.product.category ?? "",
          size: productBody.product.size ?? "",
          unit: productBody.product.unit ?? newProduct.unit,
          stock: 0,
          price: Number(productBody.product.sell_price_box_vat ?? 0),
          cost: Number(productBody.product.cost_price ?? unitCost),
          status: productBody.product.status,
          lifecycleStatus: productBody.product.lifecycle_status
        };
      }

      const response = await fetch("/api/data/inventory-adjustments", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode,
          productId: productForAdjustment?.id,
          quantity,
          warehouseCode: "KHO-CHINH",
          operationType,
          supplierId,
          documentCode,
          receivedAt,
          unitCost,
          discountAmount,
          vatAmount,
          paidAmount,
          note,
          idempotencyKey: crypto.randomUUID()
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được nghiệp vụ kho");
      await loadLiveData();
      alert(`${MODE_LABEL[mode]} thành công. Tồn sau: ${Number(body.stockAfter ?? 0).toLocaleString()} ${productForAdjustment?.unit ?? ""}`);
      setSelectedProduct(null);
      setIsAdjustOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được nghiệp vụ kho");
    } finally {
      setIsSaving(false);
    }
  };

  const loadApprovalRequests = async () => {
    if (!canApproveInventory) return;
    setIsLoadingApprovals(true);
    try {
      const response = await fetch("/api/data/inventory-approval-requests", {
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được lệnh chờ duyệt.");
      setApprovalRequests(body.requests ?? []);
      setIsApprovalOpen(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không tải được lệnh chờ duyệt.");
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  const reviewApproval = async (requestId: string, decision: "APPROVE" | "REJECT") => {
    try {
      const response = await fetch("/api/data/inventory-approval-requests", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({ id: requestId, decision })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không xử lý được lệnh.");
      await loadApprovalRequests();
      await loadLiveData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không xử lý được lệnh.");
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold text-zinc-900">Quản lý tồn kho</h1>
          <p className="mt-1 text-sm text-zinc-500">Nhập, xuất, kiểm kê và đề nghị xuất kho.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsInventoryActionsOpen((value) => !value)}
          className="flex w-full sm:hidden"
          aria-expanded={isInventoryActionsOpen}
        >
          Tác nghiệp kho
          {isInventoryActionsOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
        <div className={`hidden gap-2 sm:flex sm:flex-wrap ${canAdjust ? "sm:grid-cols-4" : "sm:grid-cols-1"}`}>
          <Button variant="outline" onClick={reloadInventory} size="sm" className="hidden sm:flex">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tải lại
          </Button>
          {canAdjust && (
            <>
              {canCount && <Button variant={isCountMode ? "default" : "outline"} onClick={startCountMode} className="flex-1 sm:flex-none">
                <ClipboardCheck className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Kiểm kê</span>
              </Button>}
              <Button variant="outline" onClick={() => openAdjust("OUT")} className="flex-1 sm:flex-none">
                <ArrowUpFromLine className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Xuất kho</span>
              </Button>
              <Button onClick={() => openReceipt()} className="flex-1 sm:flex-none">
                <ArrowDownToLine className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nhập kho</span>
              </Button>
            </>
          )}
          {!canAdjust && canCount && (
            <Button variant={isCountMode ? "default" : "outline"} onClick={startCountMode} className="flex-1 sm:flex-none">
              <ClipboardCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Kiểm kê</span>
            </Button>
          )}
          {canApproveInventory && (
            <Button variant="outline" onClick={loadApprovalRequests} disabled={isLoadingApprovals} className="col-span-full sm:col-span-auto sm:flex-none">
              <Check className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Duyệt lệnh</span>
            </Button>
          )}
          {!canAdjust && canRequest && (
            <Button onClick={() => openAdjust("REQUEST_EXPORT")} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Đề nghị xuất kho
            </Button>
          )}
        </div>
        {isInventoryActionsOpen && (
          <div className={`grid w-full gap-2 sm:hidden ${canAdjust ? "grid-cols-4" : "grid-cols-1"}`}>
            <Button variant="outline" onClick={reloadInventory} aria-label="Tải lại tồn kho" className="min-w-0 px-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canAdjust && (
              <>
                {canCount && <Button variant={isCountMode ? "default" : "outline"} onClick={startCountMode} aria-label="Kiểm kê" className="min-w-0 px-0"><ClipboardCheck className="h-4 w-4" /></Button>}
                <Button variant="outline" onClick={() => openAdjust("OUT")} aria-label="Xuất kho" className="min-w-0 px-0"><ArrowUpFromLine className="h-4 w-4" /></Button>
                <Button onClick={() => openReceipt()} aria-label="Nhập kho" className="min-w-0 px-0"><ArrowDownToLine className="h-4 w-4" /></Button>
              </>
            )}
            {!canAdjust && canCount && <Button variant={isCountMode ? "default" : "outline"} onClick={startCountMode} aria-label="Kiểm kê"><ClipboardCheck className="h-4 w-4" /></Button>}
            {canApproveInventory && <Button variant="outline" onClick={loadApprovalRequests} disabled={isLoadingApprovals} className="col-span-full"><Check className="mr-2 h-4 w-4" />Duyệt lệnh</Button>}
            {!canAdjust && canRequest && <Button onClick={() => openAdjust("REQUEST_EXPORT")} className="w-full"><Send className="mr-2 h-4 w-4" />Đề nghị xuất kho</Button>}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-6 custom-scrollbar">
        {isCountMode ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-800 sm:mb-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div>
                {canAdjust ? "Admin/Kho lưu kiểm kê sẽ cập nhật tồn kho ngay." : "Kế toán chỉnh kiểm kê sẽ gửi lệnh chờ admin duyệt."}
              </div>
              <div className="mt-2 shrink-0 font-bold sm:mt-0">{countChangedRows.length} dòng thay đổi</div>
            </div>

            <div className="mb-3 grid gap-3 sm:mb-4 lg:grid-cols-[1fr_320px_220px]">
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú chung: VD kiểm kê cuối ngày..." />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm trong sheet kiểm kê..."
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setIsCountMode(false)} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" /> Hủy
                </Button>
                <Button onClick={saveCountSheet} disabled={isSaving || countChangedRows.length === 0}>
                  <Check className="mr-2 h-4 w-4" /> {isSaving ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="h-full overflow-auto custom-scrollbar">
                <table className="min-w-[860px] w-full table-fixed divide-y divide-zinc-200 text-sm">
                  <colgroup>
                    <col className="w-[120px]" />
                    <col />
                    <col className="w-[130px]" />
                    <col className="w-[150px]" />
                    <col className="w-[110px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-zinc-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">Mã</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">Hàng hóa</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Tồn hiện tại</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Tồn kiểm kê</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Lệch</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {countVisibleRows.map(({ row, index }) => {
                      const diff = Number(row.quantity) - Number(row.currentStock);
                      return (
                        <tr key={row.productId} className={diff !== 0 ? "bg-amber-50/60" : "hover:bg-zinc-50"}>
                          <td className="px-3 py-3 font-bold text-emerald-700">{row.code}</td>
                          <td className="px-3 py-3">
                            <div className="line-clamp-2 break-words font-semibold text-zinc-900">{row.name}</div>
                            <div className="text-xs text-zinc-500">{row.unit}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-zinc-600">{row.currentStock.toLocaleString()}</td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={row.quantity}
                              onChange={(event) => updateCountRow(index, { quantity: Number(event.target.value) || 0 })}
                              className="h-10 w-full rounded-md border border-zinc-200 px-2 text-right text-[16px] font-bold outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm"
                            />
                          </td>
                          <td className={`px-3 py-3 text-right font-bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-emerald-600" : "text-zinc-400"}`}>
                            {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={row.note}
                              onChange={(event) => updateCountRow(index, { note: event.target.value })}
                              className="h-10 w-full rounded-md border border-zinc-200 px-2 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm"
                              placeholder="Lý do lệch..."
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {countVisibleRows.length === 0 && (
                  <div className="py-12 text-center text-zinc-500">Không tìm thấy hàng hóa trong sheet kiểm kê.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
        <>
        <div className="mb-3 max-w-full rounded-xl border border-zinc-200 bg-white p-2 shadow-sm sm:mb-4 sm:p-3">
          <div className="grid min-w-0 gap-2 xl:grid-cols-[0.9fr_1.1fr_1.4fr] xl:gap-3">
            <div className="grid min-w-0 grid-cols-4 gap-2">
              <CompactStat label="Giá trị tồn" value={`${totalValue.toLocaleString()} ₫`} tone="green" />
              <CompactStat label="Hết/âm" value={String(lowStock.length)} tone="red" />
              <CompactStat label="Gần hết" value={String(nearLowStock.length)} tone="red" />
              <CompactStat label="Mã hàng" value={String(products.length)} tone="dark" />
            </div>

            <div className={`${isInventorySummaryOpen ? "block" : "hidden"} min-w-0 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:p-3 xl:block`}>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Tồn theo danh mục</div>
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {inventoryByCategory.map(([category, summary]) => (
                  <div key={category} className="min-w-[120px] rounded-md bg-white px-3 py-2 ring-1 ring-zinc-200">
                    <div className="truncate text-xs font-medium text-zinc-500">{category}</div>
                    <div className="text-base font-bold text-zinc-900">{summary.value.toLocaleString()} ₫</div>
                    <div className="text-xs text-zinc-500">{summary.count} mã hàng</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${isInventorySummaryOpen ? "block" : "hidden"} min-w-0 rounded-lg border border-red-100 bg-red-50 p-2 sm:p-3 xl:block`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-red-700">Lưu ý tồn kho</div>
                <div className="ml-2 shrink-0 text-xs font-semibold text-red-600">{lowStock.length} hết/âm, {nearLowStock.length} gần hết</div>
              </div>
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {inventoryWarnings.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => setInfoPreview({ title: product.code, content: `${product.name}\nTồn: ${product.stock.toLocaleString()} ${product.unit}` })}
                    className="min-w-[150px] max-w-[150px] rounded-md bg-white px-3 py-2 text-left ring-1 ring-red-100 sm:min-w-[170px] sm:max-w-none"
                  >
                    <div className="truncate text-xs font-bold text-red-700">{product.code}</div>
                    <div className="truncate text-xs text-zinc-600">{product.name}</div>
                    <div className={`mt-1 text-sm font-bold ${product.stock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                      {product.stock.toLocaleString()} {product.unit}
                    </div>
                  </button>
                ))}
                {inventoryWarnings.length === 0 && (
                  <div className="rounded-md bg-white px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">Chưa có hàng gần hết.</div>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setIsInventorySummaryOpen((value) => !value)} className="mt-2 flex w-full items-center justify-center gap-1 border-t border-zinc-100 pt-2 text-xs font-bold text-zinc-600 xl:hidden">
            {isInventorySummaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {isInventorySummaryOpen ? "Thu gọn danh mục và cảnh báo" : "Xem danh mục và cảnh báo"}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:justify-between">
          <h2 className="font-bold text-zinc-900 text-lg hidden sm:block">Chi tiết tồn kho</h2>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <select value={stockStatusFilter} onChange={(event) => { setStockStatusFilter(event.target.value as "ALL" | "LOW" | "AVAILABLE"); setStockPage(1); }} className="h-11 w-[142px] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-sm sm:h-10 sm:w-auto sm:px-3"><option value="ALL">Tất cả tồn kho</option><option value="LOW">Cần nhập thêm</option><option value="AVAILABLE">Đủ tồn</option></select>
          <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input 
              value={searchTerm} 
              onChange={(event) => { setSearchTerm(event.target.value); setStockPage(1); }}
              placeholder="Tìm sản phẩm…"
              className="pl-10" 
            />
          </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="sticky top-0 bg-zinc-50 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">Mã hàng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">Tên hàng</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-zinc-500">Tồn kho</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-zinc-500">Giá trị tồn</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-zinc-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {pagedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-emerald-600">{product.code}</td>
                    <td className="px-4 py-3 text-sm text-zinc-900 font-medium">
                      {product.name}
                      {product.size && <div className="text-xs text-zinc-500 font-normal mt-0.5">{product.size}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.stock <= 0 
                          ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10" 
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                      }`}>
                        {product.stock.toLocaleString()} {product.unit}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                      {(product.stock * product.cost).toLocaleString()} ₫
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-2 justify-end w-full">
                        {canAdjust && <Button variant="outline" size="sm" onClick={() => openReceipt(product)}>Nhập</Button>}
                        {canAdjust && <Button variant="outline" size="sm" onClick={() => openAdjust("OUT", product)}>Xuất</Button>}
                        {canAdjust && <Button variant="outline" size="sm" onClick={startCountMode}>Kiểm</Button>}
                        {!canAdjust && canRequest && <Button variant="outline" size="sm" onClick={() => openAdjust("REQUEST_EXPORT", product)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">Đề nghị</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
          {pagedProducts.map((product) => (
            <div key={product.id} className="bg-white p-3 rounded-xl shadow-sm border border-zinc-200">
              <div className="flex min-w-0 justify-between items-start mb-3 gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setInfoPreview({ title: product.code, content: product.name })}
                    className="block w-full text-left"
                    title={product.name}
                  >
                    <h3 className="line-clamp-2 break-words text-base font-semibold leading-tight text-zinc-900">{product.name}</h3>
                  </button>
                  <div className="text-sm font-medium text-emerald-600">{product.code}</div>
                  {product.name.length > 34 && (
                    <button
                      type="button"
                      onClick={() => setInfoPreview({ title: product.code, content: product.name })}
                      className="mt-1 text-xs font-semibold text-zinc-500 underline decoration-zinc-300"
                    >
                      Xem đầy đủ
                    </button>
                  )}
                </div>
                <div className="max-w-[92px] shrink-0 text-right">
                  <div className={`mb-1 truncate text-xl font-bold leading-none ${product.stock <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {product.stock.toLocaleString()}
                  </div>
                  <div className="inline-block max-w-full truncate rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{product.unit}</div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={() => openReceipt(product)}>Nhập</Button>}
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={() => openAdjust("OUT", product)}>Xuất</Button>}
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={startCountMode}>Kiểm</Button>}
                {!canAdjust && canRequest && <Button variant="outline" className="flex-1 h-9 px-0 text-emerald-600 border-emerald-200" onClick={() => openAdjust("REQUEST_EXPORT", product)}>Đề nghị</Button>}
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <PackageSearch className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>Không tìm thấy sản phẩm nào</p>
            </div>
          )}
        </div>
        {filteredProducts.length > 0 && <div className="mt-3 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-zinc-500">{filteredProducts.length} mã hàng · Trang {stockPage}/{stockTotalPages}</span><div className="flex items-center gap-2"><select value={stockPageSize} onChange={(event) => { setStockPageSize(Number(event.target.value)); setStockPage(1); }} className="h-9 rounded-md border border-zinc-200 bg-white px-2"><option value={10}>10 / trang</option><option value={20}>20 / trang</option><option value={50}>50 / trang</option></select><Button size="sm" variant="outline" disabled={stockPage <= 1} onClick={() => setStockPage((page) => page - 1)}>Trước</Button><Button size="sm" variant="outline" disabled={stockPage >= stockTotalPages} onClick={() => setStockPage((page) => page + 1)}>Sau</Button></div></div>}
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-zinc-900">Biến động kho gần đây</h2><span className="text-xs font-semibold text-zinc-500">Kho chính</span></div>
          <div className="space-y-2">
            {transactions.slice(0, 8).map((transaction) => {
              const product = products.find((item) => item.id === transaction.product_id);
              return <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"><div className="min-w-0"><div className="truncate font-bold text-zinc-900">{product?.code ?? "Hàng hóa"} · {product?.name ?? transaction.product_id}</div><div className="truncate text-xs text-zinc-500">{transaction.source_type} · {new Date(transaction.created_at).toLocaleString("vi-VN")}</div></div><div className="shrink-0 text-right"><div className={`font-black tabular-nums ${Number(transaction.quantity_change) < 0 ? "text-red-600" : "text-emerald-700"}`}>{Number(transaction.quantity_change) > 0 ? "+" : ""}{Number(transaction.quantity_change).toLocaleString()}</div><div className="text-xs text-zinc-500">Tồn {Number(transaction.stock_after).toLocaleString()}</div></div></div>;
            })}
            {transactions.length === 0 && <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">Chưa có biến động kho để hiển thị.</div>}
          </div>
        </div>
        </>
        )}
      </div>

      <Dialog isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title={MODE_LABEL[mode]} className={mode === "IN" ? "sm:max-w-3xl" : undefined}>
        <div className="flex flex-col h-full">
          {mode === "COUNT" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                {canAdjust ? "Admin/Kho lưu kiểm kê sẽ cập nhật tồn kho ngay." : "Kế toán chỉnh kiểm kê sẽ gửi lệnh chờ admin duyệt."}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Ghi chú chung</label>
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="VD: Kiểm kê cuối ngày..." />
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white custom-scrollbar">
                <table className="min-w-[760px] w-full table-fixed divide-y divide-zinc-200 text-sm">
                  <colgroup>
                    <col className="w-[110px]" />
                    <col />
                    <col className="w-[120px]" />
                    <col className="w-[140px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-zinc-500">Mã</th>
                      <th className="px-3 py-2 text-left font-bold text-zinc-500">Hàng hóa</th>
                      <th className="px-3 py-2 text-right font-bold text-zinc-500">Tồn hiện tại</th>
                      <th className="px-3 py-2 text-right font-bold text-zinc-500">Tồn kiểm kê</th>
                      <th className="px-3 py-2 text-left font-bold text-zinc-500">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {countRows.map((row, index) => (
                      <tr key={row.productId} className={row.quantity !== row.currentStock ? "bg-amber-50/50" : ""}>
                        <td className="px-3 py-2 font-bold text-emerald-700">{row.code}</td>
                        <td className="px-3 py-2">
                          <div className="line-clamp-2 break-words font-semibold text-zinc-900">{row.name}</div>
                          <div className="text-xs text-zinc-500">{row.unit}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-zinc-600">{row.currentStock.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={row.quantity}
                            onChange={(event) => setCountRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) || 0 } : item))}
                            className="h-9 w-full rounded-md border border-zinc-200 px-2 text-right text-[16px] font-bold outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.note}
                            onChange={(event) => setCountRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))}
                            className="h-9 w-full rounded-md border border-zinc-200 px-2 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm"
                            placeholder="Lý do..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <div className="space-y-5 flex-1">
            {mode === "IN" && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <label className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                  <input
                    type="checkbox"
                    checked={isCreatingProduct}
                    onChange={(event) => {
                      setIsCreatingProduct(event.target.checked);
                      if (event.target.checked) setSelectedProduct(null);
                    }}
                    className="h-4 w-4"
                  />
                  <Plus className="h-4 w-4" />
                  Nhập kho hàng hóa mới
                </label>
                <div className="mt-1 text-xs text-emerald-700">Tạo mã hàng ngay tại phiếu nhập rồi ghi nhận giá vốn, công nợ nhà cung cấp.</div>
              </div>
            )}

            {mode === "IN" && isCreatingProduct ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mã hàng mới (*)</label>
                  <Input value={newProduct.code} onChange={(event) => setNewProduct((current) => ({ ...current, code: event.target.value }))} placeholder="VD: SP001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Đơn vị tính</label>
                  <Input value={newProduct.unit} onChange={(event) => setNewProduct((current) => ({ ...current, unit: event.target.value }))} placeholder="HỘP, CÁI, KG..." />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tên hàng hóa mới (*)</label>
                  <Input value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} placeholder="Tên hàng hóa..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Danh mục</label>
                  <Input value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))} placeholder="VD: Gạch, keo, phụ kiện..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Quy cách</label>
                  <Input value={newProduct.size} onChange={(event) => setNewProduct((current) => ({ ...current, size: event.target.value }))} placeholder="VD: 400x800, 20kg..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Giá bán dự kiến</label>
                  <Input type="number" value={newProduct.salePrice || ""} onChange={(event) => setNewProduct((current) => ({ ...current, salePrice: Number(event.target.value) || 0 }))} placeholder="0" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Sản phẩm</label>
                <SearchableSelect
                  value={selectedProduct?.id ?? ""}
                  onChange={(value) => {
                    const product = products.find((item) => item.id === value) ?? null;
                    setSelectedProduct(product);
                    if (mode === "IN") setUnitCost(Number(product?.cost ?? 0));
                  }}
                  placeholder="-- Chọn sản phẩm --"
                  searchPlaceholder="Tìm mã hoặc tên hàng hóa..."
                  options={products.map((product) => ({ value: product.id, label: `${product.code} - ${product.name}`, description: `Tồn ${product.stock.toLocaleString()} ${product.unit}` }))}
                />
              </div>
            )}
            
            {selectedProduct && (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 flex items-center justify-between">
                <span className="text-sm text-zinc-500">Tồn hiện tại:</span>
                <div className="text-lg font-bold text-zinc-900">
                  {selectedProduct.stock.toLocaleString()} <span className="text-sm font-normal text-zinc-500 ml-1">{selectedProduct.unit}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Loại nghiệp vụ</label>
                <select
                  value={operationType}
                  onChange={(event) => setOperationType(event.target.value)}
                  className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {inventoryOperations
                    .filter((item) => mode === "IN" ? item.direction === "IN" : item.direction === "OUT")
                    .map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </div>
              {mode === "IN" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ngày nhập</label>
                  <Input type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">{mode === "COUNT" ? "Tồn thực tế sau kiểm kê" : "Số lượng"}</label>
              <Input 
                type="number" 
                value={quantity || ""} 
                onChange={(event) => setQuantity(Number(event.target.value) || 0)} 
                placeholder="Nhập số lượng..."
              />
            </div>

            {mode === "IN" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nhà cung cấp</label>
                    <SearchableSelect value={supplierId} onChange={setSupplierId} placeholder="-- Chưa chọn NCC --" searchPlaceholder="Tìm mã hoặc tên NCC..." options={suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code ? `${supplier.code} - ` : ""}${supplier.name}`, description: supplier.phone }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Số chứng từ</label>
                    <Input value={documentCode} onChange={(event) => setDocumentCode(event.target.value)} placeholder="Tự tạo nếu bỏ trống" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Giá nhập</label>
                    <Input type="number" value={unitCost || ""} onChange={(event) => setUnitCost(Number(event.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Giảm giá</label>
                    <Input type="number" value={discountAmount || ""} onChange={(event) => setDiscountAmount(Number(event.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">VAT/Chi phí</label>
                    <Input type="number" value={vatAmount || ""} onChange={(event) => setVatAmount(Number(event.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Đã trả</label>
                    <Input type="number" value={paidAmount || ""} onChange={(event) => setPaidAmount(Number(event.target.value) || 0)} placeholder="0" />
                  </div>
                </div>
                <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-500">Tiền hàng</div>
                    <div className="mt-1 font-black text-zinc-900">{(quantity * unitCost).toLocaleString()} đ</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-500">Tổng nhập</div>
                    <div className="mt-1 font-black text-emerald-700">{stockInTotal.toLocaleString()} đ</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-500">Còn phải trả</div>
                    <div className={`mt-1 font-black ${stockInPayable > 0 ? "text-red-600" : "text-zinc-900"}`}>{stockInPayable.toLocaleString()} đ</div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ghi chú</label>
              <textarea 
                value={note} 
                onChange={(event) => setNote(event.target.value)} 
                rows={3} 
                className="flex w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none" 
                placeholder={mode === "REQUEST_EXPORT" ? "Lý do đề nghị xuất kho..." : "Ghi chú nghiệp vụ kho..."} 
              />
            </div>
          </div>
          )}
          
          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)} className="flex-1">Hủy</Button>
            <Button onClick={saveAdjustment} disabled={isSaving} className="flex-1">
              {isSaving ? "Đang lưu..." : "Xác nhận"}
            </Button>
          </div>
        </div>
      </Dialog>

      <InventoryReceiptDialog isOpen={isReceiptOpen} products={products} suppliers={suppliers} initialProductId={receiptInitialProductId} onClose={() => { setIsReceiptOpen(false); setReceiptInitialProductId(undefined); }} onSaved={reloadInventory} />

      <Dialog isOpen={Boolean(infoPreview)} onClose={() => setInfoPreview(null)} title={infoPreview?.title ?? "Chi tiết"}>
        <div className="whitespace-pre-wrap break-words rounded-lg border border-zinc-100 bg-white p-4 text-sm font-medium leading-6 text-zinc-800">
          {infoPreview?.content}
        </div>
      </Dialog>

      <Dialog isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} title="Duyệt lệnh kiểm kê" className="sm:max-w-4xl">
        <div className="space-y-4">
          {approvalRequests.map((request) => (
            <div key={request.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-zinc-900">Lệnh {request.id.slice(0, 8)}</div>
                  <div className="text-sm text-zinc-500">{new Date(request.created_at).toLocaleString("vi-VN")} · {request.items.length} dòng</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${request.status === "PENDING" ? "bg-amber-50 text-amber-700" : request.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{request.status}</span>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100 custom-scrollbar">
                <table className="min-w-[680px] w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Mã</th>
                      <th className="px-3 py-2 text-left">Hàng hóa</th>
                      <th className="px-3 py-2 text-right">Cũ</th>
                      <th className="px-3 py-2 text-right">Mới</th>
                      <th className="px-3 py-2 text-right">Lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {request.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-bold text-emerald-700">{item.products?.code ?? item.product_id}</td>
                        <td className="px-3 py-2">{item.products?.product_name ?? "-"}</td>
                        <td className="px-3 py-2 text-right">{Number(item.old_quantity_box).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold">{Number(item.new_quantity_box).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{Number(item.quantity_change).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {request.status === "PENDING" && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => reviewApproval(request.id, "REJECT")}><X className="mr-2 h-4 w-4" />Từ chối</Button>
                  <Button onClick={() => reviewApproval(request.id, "APPROVE")}><Check className="mr-2 h-4 w-4" />Duyệt và cập nhật kho</Button>
                </div>
              )}
            </div>
          ))}
          {approvalRequests.length === 0 && <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-zinc-500">Chưa có lệnh kiểm kê nào.</div>}
        </div>
      </Dialog>
    </div>
  );
}

function CompactStat({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "dark" }) {
  const isGreen = tone === "green";
  const isRed = tone === "red";
  
  return (
    <div className="min-w-0 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:p-3">
      <div className="mb-1 truncate text-[11px] font-semibold text-zinc-500 sm:text-xs">{label}</div>
      <div className={`truncate text-lg font-bold ${
        isGreen ? "text-emerald-600" : isRed ? "text-red-600" : "text-zinc-900"
      }`}>{value}</div>
    </div>
  );
}
