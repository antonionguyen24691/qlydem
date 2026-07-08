import { TrendingUp, Users, Package, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Dashboard() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-zinc-500">Theo dõi doanh thu và hoạt động kinh doanh hôm nay.</p>
      </div>
      
      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/50 shadow-sm flex flex-col justify-between h-[140px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Doanh thu hôm nay</p>
            <DollarSign className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-900">24.5<span className="text-xl text-zinc-500 font-medium">tr</span></p>
            <p className="mt-2 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              +12.5% so với hôm qua
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/50 shadow-sm flex flex-col justify-between h-[140px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Đơn hàng mới</p>
            <TrendingUp className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-900">12</p>
            <p className="mt-2 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              +3 đơn so với hôm qua
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/50 shadow-sm flex flex-col justify-between h-[140px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Sản phẩm sắp hết</p>
            <Package className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-900">5</p>
            <p className="mt-2 flex items-center text-xs text-red-600 font-medium bg-red-50 w-fit px-2 py-0.5 rounded-full">
              <ArrowDownRight className="mr-1 h-3 w-3" />
              Cần nhập hàng ngay
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/50 shadow-sm flex flex-col justify-between h-[140px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Khách hàng nợ</p>
            <Users className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-900">8</p>
            <p className="mt-2 flex items-center text-xs text-zinc-600 font-medium bg-zinc-100 w-fit px-2 py-0.5 rounded-full">
              Tổng nợ: 145.2tr
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm p-6 lg:col-span-4 h-[400px]">
          <h2 className="text-base font-semibold text-zinc-900 mb-6">Biểu đồ doanh thu 7 ngày</h2>
          <div className="flex h-[300px] items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 border-dashed">
            <p className="text-sm text-zinc-400">[Chart Component Placeholder]</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm p-6 lg:col-span-3 h-[400px] flex flex-col">
          <h2 className="text-base font-semibold text-zinc-900 mb-6">Sản phẩm bán chạy</h2>
          <div className="flex-1 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 border-dashed">
            <p className="text-sm text-zinc-400">[List Component Placeholder]</p>
          </div>
        </div>
      </div>
    </div>
  );
}
