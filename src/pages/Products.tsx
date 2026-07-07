import React, { useState } from "react";
import { useDataStore, Product } from "../store/data";
import { Search, Plus, Filter } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";

export function Products() {
  const { products, addProduct } = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    code: "", name: "", category: "", unit: "Cái", size: "", price: 0, cost: 0, stock: 0
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.code || !newProduct.name) {
      alert("Vui lòng nhập mã và tên hàng hóa");
      return;
    }
    addProduct({
      ...newProduct,
      id: String(Date.now()),
    } as Product);
    setIsAddOpen(false);
    setNewProduct({ code: "", name: "", category: "", unit: "Cái", size: "", price: 0, cost: 0, stock: 0 });
    alert("Thêm sản phẩm thành công!");
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center sm:text-left">Danh mục hàng hóa</h1>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 rounded bg-[#006B68] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005a57] w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Thêm hàng hóa
        </button>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo mã, tên hàng..."
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-[#006B68] outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-md bg-white text-gray-700 hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            Lọc
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên hàng hóa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Danh mục</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ĐVT</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Giá vốn</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Giá bán</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tồn kho</th>
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
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {product.name}
                      <div className="text-xs text-gray-500">{product.size}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{product.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{product.cost.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{product.price.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock < 100 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {product.stock}
                      </span>
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
        title="Thông tin chi tiết hàng hóa"
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
              <div>
                <span className="text-gray-500">Quy cách/Kích thước:</span>
                <div className="font-medium text-gray-900">{selectedProduct.size || "-"}</div>
              </div>
              <div>
                <span className="text-gray-500">Tồn kho hiện tại:</span>
                <div className={`font-bold ${selectedProduct.stock < 100 ? 'text-red-600' : 'text-green-600'}`}>
                  {selectedProduct.stock} {selectedProduct.unit}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b py-4">
               <div>
                  <span className="text-gray-500 text-sm">Giá vốn</span>
                  <div className="font-bold text-gray-900 text-lg">{selectedProduct.cost.toLocaleString()} đ</div>
               </div>
               <div>
                  <span className="text-gray-500 text-sm">Giá bán lẻ</span>
                  <div className="font-bold text-[#006B68] text-lg">{selectedProduct.price.toLocaleString()} đ</div>
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

      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Hàng Hóa Mới">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã hàng (*)</label>
              <input 
                type="text" 
                value={newProduct.code}
                onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
              <input 
                type="text" 
                value={newProduct.category}
                onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa (*)</label>
            <input 
              type="text" 
              value={newProduct.name}
              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label>
              <input 
                type="text" 
                value={newProduct.unit}
                onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quy cách/Kích thước</label>
              <input 
                type="text" 
                value={newProduct.size}
                onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá vốn</label>
              <input 
                type="number" 
                value={newProduct.cost}
                onChange={e => setNewProduct({...newProduct, cost: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán</label>
              <input 
                type="number" 
                value={newProduct.price}
                onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-[#006B68] outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button 
              type="button" 
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-[#006B68] text-white rounded-md text-sm font-medium hover:bg-[#005a57]"
            >
              Lưu hàng hóa
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
