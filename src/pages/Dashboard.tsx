import { TrendingUp, Users, Package, DollarSign } from "lucide-react";

export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tổng quan</h1>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-[#006B68]/10 p-3 text-[#006B68]">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Doanh thu hôm nay</p>
              <p className="text-2xl font-semibold text-gray-900">24,500,000 đ</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Đơn hàng mới</p>
              <p className="text-2xl font-semibold text-gray-900">12</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-yellow-50 p-3 text-yellow-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Sản phẩm sắp hết</p>
              <p className="text-2xl font-semibold text-gray-900">5</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-50 p-3 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Khách hàng nợ</p>
              <p className="text-2xl font-semibold text-gray-900">8</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-6 h-96">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Biểu đồ doanh thu</h2>
          <div className="flex h-full items-center justify-center text-gray-400">
            [Biểu đồ Chart.js / Recharts]
          </div>
        </div>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-6 h-96">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sản phẩm bán chạy</h2>
          <div className="flex h-full items-center justify-center text-gray-400">
            [Danh sách sản phẩm]
          </div>
        </div>
      </div>
    </div>
  );
}
