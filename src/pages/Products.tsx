import React, { useState } from "react";
import { useDataStore, Product } from "../store/data";
import { Search, Plus, Filter, Package } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

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
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b border-zinc-200 gap-4">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Danh mục hàng hóa</h1>
        <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Thêm hàng hóa
        </Button>
      </div>

      <div className="p-4 sm:p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo mã, tên hàng..."
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="shrink-0 w-full sm:w-auto">
            <Filter className="h-4 w-4 mr-2" />
            Bộ lọc
          </Button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 overflow-hidden flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mã hàng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tên hàng hóa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Danh mục</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">ĐVT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Giá vốn</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Giá bán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tồn kho</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-emerald-600">{product.code}</td>
                    <td className="px-4 py-3 text-sm text-zinc-900 font-medium">
                      {product.name}
                      {product.size && <div className="text-xs text-zinc-500 font-normal mt-0.5">{product.size}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500">{product.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 text-center">{product.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 text-right">{product.cost.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-zinc-900 text-right">{product.price.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.stock < 100 ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10'
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

        {/* Mobile Card View */}
        <div className="md:hidden flex-1 overflow-y-auto space-y-3 custom-scrollbar pb-20">
          {filteredProducts.map((product) => (
            <div 
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 active:scale-[0.98] transition-transform"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-zinc-900 text-base">{product.name}</h3>
                  <div className="text-sm font-medium text-emerald-600 mt-0.5">{product.code}</div>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  product.stock < 100 ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10'
                }`}>
                  Tồn: {product.stock}
                </span>
              </div>
              <div className="flex justify-between items-end mt-4">
                <div className="text-sm text-zinc-500">
                  {product.category && <span className="mr-2">{product.category}</span>}
                  <span className="bg-zinc-100 px-2 py-0.5 rounded text-xs">{product.unit}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500 line-through mb-0.5">Vốn: {product.cost.toLocaleString()}</div>
                  <div className="text-lg font-bold text-zinc-900 leading-none">{product.price.toLocaleString()} đ</div>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Package className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p>Không tìm thấy sản phẩm nào</p>
            </div>
          )}
        </div>
      </div>

      {/* Product Detail Dialog */}
      <Dialog 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        title="Chi tiết hàng hóa"
      >
        {selectedProduct && (
          <div className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <div className="text-sm text-zinc-500 mb-1">Mã hàng</div>
                <div className="font-bold text-emerald-600 text-lg">{selectedProduct.code}</div>
                
                <div className="mt-4 text-sm text-zinc-500 mb-1">Tên hàng hóa</div>
                <div className="font-bold text-zinc-900 text-xl">{selectedProduct.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500 block mb-1">Danh mục</span>
                  <div className="font-medium text-zinc-900">{selectedProduct.category || "-"}</div>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Đơn vị tính</span>
                  <div className="font-medium text-zinc-900 bg-zinc-100 px-2 py-1 rounded inline-block">{selectedProduct.unit}</div>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Quy cách</span>
                  <div className="font-medium text-zinc-900">{selectedProduct.size || "-"}</div>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Tồn kho hiện tại</span>
                  <div className={`font-bold text-lg ${selectedProduct.stock < 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {selectedProduct.stock}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6">
                 <div>
                    <span className="text-zinc-500 text-sm block mb-1">Giá vốn</span>
                    <div className="font-bold text-zinc-900 text-xl">{selectedProduct.cost.toLocaleString()} đ</div>
                 </div>
                 <div>
                    <span className="text-zinc-500 text-sm block mb-1">Giá bán lẻ</span>
                    <div className="font-bold text-emerald-600 text-2xl">{selectedProduct.price.toLocaleString()} đ</div>
                 </div>
              </div>
            </div>

            <div className="mt-8">
               <Button onClick={() => setSelectedProduct(null)} variant="outline" className="w-full">
                 Đóng
               </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Hàng Hóa Mới">
        <form onSubmit={handleAddSubmit} className="flex flex-col h-full">
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Mã hàng (*)</label>
                <Input 
                  type="text" 
                  value={newProduct.code}
                  onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                  required
                  placeholder="VD: SP001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Danh mục</label>
                <Input 
                  type="text" 
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  placeholder="Điện thoại, Ốp lưng..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tên hàng hóa (*)</label>
              <Input 
                type="text" 
                value={newProduct.name}
                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                required
                placeholder="Nhập tên sản phẩm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Đơn vị tính</label>
                <Input 
                  type="text" 
                  value={newProduct.unit}
                  onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Quy cách</label>
                <Input 
                  type="text" 
                  value={newProduct.size}
                  onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                  placeholder="Đen, Trắng, 128GB..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Giá vốn</label>
                <Input 
                  type="number" 
                  value={newProduct.cost}
                  onChange={e => setNewProduct({...newProduct, cost: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Giá bán</label>
                <Input 
                  type="number" 
                  value={newProduct.price}
                  onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-8 pt-4 border-t border-zinc-100">
            <Button type="button" onClick={() => setIsAddOpen(false)} variant="outline" className="w-full">
              Hủy
            </Button>
            <Button type="submit" className="w-full">
              Lưu hàng hóa
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
