import { useMemo, useState } from "react";
import { useDataStore, Product } from "../store/data";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, RefreshCw, Search, Send, PackageX, PackageSearch } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/auth";
import { canManageInventory, canRequestStockOut } from "../lib/permissions";
import { getAuthHeaders } from "../lib/supabase";

type InventoryMode = "IN" | "OUT" | "COUNT" | "REQUEST_EXPORT";

const MODE_LABEL: Record<InventoryMode, string> = {
  IN: "Nhập kho",
  OUT: "Xuất kho",
  COUNT: "Kiểm kê",
  REQUEST_EXPORT: "Đề nghị xuất kho"
};

export function Inventory() {
  const { products, loadLiveData } = useDataStore();
  const user = useAuthStore((state) => state.user);
  const canAdjust = canManageInventory(user);
  const canRequest = canRequestStockOut(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [mode, setMode] = useState<InventoryMode>("IN");
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    return product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term);
  });

  const lowStock = products.filter((product) => product.stock <= 0);
  const totalValue = products.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const inventoryByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) map.set(product.category || "Khác", (map.get(product.category || "Khác") ?? 0) + product.stock);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [products]);

  const openAdjust = (nextMode: InventoryMode, product?: Product) => {
    if (nextMode === "REQUEST_EXPORT" ? !canRequest : !canAdjust) return;
    setMode(nextMode);
    setSelectedProduct(product ?? null);
    setQuantity(product && nextMode === "COUNT" ? product.stock : 0);
    setNote("");
    setIsAdjustOpen(true);
  };

  const saveAdjustment = async () => {
    if (!selectedProduct) {
      alert("Vui lòng chọn sản phẩm.");
      return;
    }
    if (quantity <= 0 && mode !== "COUNT") {
      alert("Số lượng phải lớn hơn 0.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/data/inventory-adjustments", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode,
          productId: selectedProduct.id,
          quantity,
          warehouseCode: "KHO-CHINH",
          note
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được nghiệp vụ kho");
      await loadLiveData();
      alert(`${MODE_LABEL[mode]} thành công. Tồn sau: ${Number(body.stockAfter ?? 0).toLocaleString()} ${selectedProduct.unit}`);
      setSelectedProduct(null);
      setIsAdjustOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không lưu được nghiệp vụ kho");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Quản lý tồn kho</h1>
          <p className="text-sm text-zinc-500 hidden sm:block mt-1">Nhập, xuất, kiểm kê và đề nghị xuất kho.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadLiveData()} size="sm" className="hidden sm:flex">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tải lại
          </Button>
          <Button variant="outline" onClick={() => loadLiveData()} className="sm:hidden flex-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canAdjust && (
            <>
              <Button variant="outline" onClick={() => openAdjust("COUNT")} className="flex-1 sm:flex-none">
                <ClipboardCheck className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Kiểm kê</span>
              </Button>
              <Button variant="outline" onClick={() => openAdjust("OUT")} className="flex-1 sm:flex-none">
                <ArrowUpFromLine className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Xuất kho</span>
              </Button>
              <Button onClick={() => openAdjust("IN")} className="flex-1 sm:flex-none">
                <ArrowDownToLine className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nhập kho</span>
              </Button>
            </>
          )}
          {!canAdjust && canRequest && (
            <Button onClick={() => openAdjust("REQUEST_EXPORT")} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Đề nghị xuất kho
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-4 sm:p-6 custom-scrollbar">
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Tổng giá trị tồn kho" value={`${totalValue.toLocaleString()} ₫`} tone="green" />
          <Stat label="Mã hàng hết hoặc âm kho" value={String(lowStock.length)} tone="red" />
          <Stat label="Tổng mã hàng" value={String(products.length)} tone="dark" />
        </div>

        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hidden sm:block">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Tồn theo danh mục</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {inventoryByCategory.map(([category, stock]) => (
              <div key={category} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 flex flex-col justify-between">
                <div className="text-xs font-medium text-zinc-500 mb-2 truncate">{category}</div>
                <div className="text-xl font-bold text-zinc-900">{stock.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-zinc-900 text-lg hidden sm:block">Chi tiết tồn kho</h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input 
              value={searchTerm} 
              onChange={(event) => setSearchTerm(event.target.value)} 
              placeholder="Tìm sản phẩm..." 
              className="pl-10" 
            />
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
                {filteredProducts.map((product) => (
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
                        {canAdjust && <Button variant="outline" size="sm" onClick={() => openAdjust("IN", product)}>Nhập</Button>}
                        {canAdjust && <Button variant="outline" size="sm" onClick={() => openAdjust("OUT", product)}>Xuất</Button>}
                        {canAdjust && <Button variant="outline" size="sm" onClick={() => openAdjust("COUNT", product)}>Kiểm</Button>}
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
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-zinc-900 text-base leading-tight mb-1">{product.name}</h3>
                  <div className="text-sm font-medium text-emerald-600">{product.code}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className={`text-xl font-bold leading-none mb-1 ${product.stock <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {product.stock}
                  </div>
                  <div className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded inline-block">{product.unit}</div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={() => openAdjust("IN", product)}>Nhập</Button>}
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={() => openAdjust("OUT", product)}>Xuất</Button>}
                {canAdjust && <Button variant="outline" className="flex-1 h-9 px-0" onClick={() => openAdjust("COUNT", product)}>Kiểm</Button>}
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
      </div>

      <Dialog isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title={MODE_LABEL[mode]}>
        <div className="flex flex-col h-full">
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Sản phẩm</label>
              <select 
                value={selectedProduct?.id ?? ""} 
                onChange={(event) => setSelectedProduct(products.find((item) => item.id === event.target.value) ?? null)} 
                className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}
              </select>
            </div>
            
            {selectedProduct && (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 flex items-center justify-between">
                <span className="text-sm text-zinc-500">Tồn hiện tại:</span>
                <div className="text-lg font-bold text-zinc-900">
                  {selectedProduct.stock.toLocaleString()} <span className="text-sm font-normal text-zinc-500 ml-1">{selectedProduct.unit}</span>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">{mode === "COUNT" ? "Tồn thực tế sau kiểm kê" : "Số lượng"}</label>
              <Input 
                type="number" 
                value={quantity || ""} 
                onChange={(event) => setQuantity(Number(event.target.value) || 0)} 
                placeholder="Nhập số lượng..."
              />
            </div>
            
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
          
          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)} className="flex-1">Hủy</Button>
            <Button onClick={saveAdjustment} disabled={isSaving} className="flex-1">
              {isSaving ? "Đang lưu..." : "Xác nhận"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "dark" }) {
  const isGreen = tone === "green";
  const isRed = tone === "red";
  
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col justify-center">
      <div className="text-sm font-medium text-zinc-500 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${
        isGreen ? "text-emerald-600" : isRed ? "text-red-600" : "text-zinc-900"
      }`}>{value}</div>
    </div>
  );
}
