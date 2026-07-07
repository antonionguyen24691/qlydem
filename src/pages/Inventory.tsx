import { useState } from "react";
import { useDataStore, Product } from "../store/data";
import { Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";

export function Inventory() {
  const { products } = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center sm:text-left">Quản lý Tồn kho</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
          <button 
            onClick={() => alert("Chức năng đang được cập nhật")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Kiểm kê</span>
          </button>
          <button 
            onClick={() => alert("Chức năng đang được cập nhật")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowUpFromLine className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Xuất kho</span>
          </button>
          <button 
            onClick={() => alert("Chức năng đang được cập nhật")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded bg-[#006B68] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005a57]"
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Nhập kho</span>
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg border shadow-sm mb-6 flex divide-x divide-gray-200">
          <div className="p-3 flex-1 text-center">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Tổng giá trị tồn kho</div>
            <div className="text-base sm:text-lg font-bold text-[#006B68] truncate">
              {products.reduce((acc, p) => acc + (p.stock * p.cost), 0).toLocaleString()} đ
            </div>
          </div>
          <div className="p-3 flex-1 text-center">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Mã hàng sắp hết</div>
            <div className="text-base sm:text-lg font-bold text-yellow-600 truncate">
              {products.filter(p => p.stock < 100).length}
            </div>
          </div>
          <div className="p-3 flex-1 text-center">
            <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Tổng mã hàng</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
              {products.length}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Chi tiết tồn kho</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm sản phẩm..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-[#006B68] outline-none"
              />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên hàng</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tồn kho</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Giá trị tồn</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#006B68]">{product.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock < 100 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {(product.stock * product.cost).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Product Detail Dialog */}
      <Dialog 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        title="Thông tin chi tiết tồn kho"
      >
        {selectedProduct && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Mã hàng:</span>
                <div className="font-medium text-[#006B68]">{selectedProduct.code}</div>
              </div>
              <div>
                <span className="text-gray-500">Tên hàng hóa:</span>
                <div className="font-medium text-gray-900">{selectedProduct.name}</div>
              </div>
              <div>
                <span className="text-gray-500">Danh mục:</span>
                <div className="font-medium text-gray-900">{selectedProduct.category}</div>
              </div>
              <div>
                <span className="text-gray-500">Đơn vị tính:</span>
                <div className="font-medium text-gray-900">{selectedProduct.unit}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b py-4">
               <div>
                  <span className="text-gray-500 text-sm">Tồn kho hiện tại</span>
                  <div className={`font-bold text-lg ${selectedProduct.stock < 100 ? 'text-red-600' : 'text-green-600'}`}>
                     {selectedProduct.stock} {selectedProduct.unit}
                  </div>
               </div>
               <div>
                  <span className="text-gray-500 text-sm">Tổng giá trị tồn kho</span>
                  <div className="font-bold text-[#006B68] text-lg">{(selectedProduct.stock * selectedProduct.cost).toLocaleString()} đ</div>
               </div>
            </div>

            <div className="flex justify-end pt-2">
               <button 
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
