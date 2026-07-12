import { Link, useLocation } from "react-router-dom";
import { BadgeDollarSign, FileText, LayoutDashboard, Menu, ShoppingCart } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store/ui";
import { useAuthStore } from "../../store/auth";
import { canSell, canViewFinance } from "../../lib/permissions";

/**
 * BottomTabBar — thanh điều hướng dưới đáy cho mobile (<lg), dùng cho mọi theme.
 * 4 lối tắt chính + nút Menu mở Sidebar drawer (đầy đủ mục còn lại).
 * Hit target ≥ 48px. Ẩn hoàn toàn trên desktop.
 *
 * Ẩn trên "/pos": POS đã có sẵn thanh cart/checkout cố định ở đáy màn hình
 * (xem POS.tsx) + drawer thanh toán trượt lên — chồng thêm tab bar ở đây sẽ
 * che mất các thao tác đó.
 *
 * Lưu ý: MainLayout thêm pb-16 lg:pb-0 cho vùng nội dung để không bị che.
 */

const tabs = [
  { name: "Tổng quan", href: "/", icon: LayoutDashboard, visible: () => true },
  { name: "Bán hàng", href: "/pos", icon: ShoppingCart, visible: canSell },
  { name: "Đơn hàng", href: "/orders", icon: FileText, visible: canSell },
  { name: "Tài chính", href: "/finance", icon: BadgeDollarSign, visible: canViewFinance }
];

export function BottomTabBar() {
  const location = useLocation();
  const { setSidebarOpen } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const visibleTabs = tabs.filter((tab) => tab.visible(user));

  if (location.pathname === "/pos") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-200 bg-white lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {visibleTabs.map((tab) => {
        const isActive = location.pathname === tab.href;
        return (
          <Link
            key={tab.name}
            to={tab.href}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
              isActive ? "text-emerald-700 font-bold" : "text-zinc-500 font-medium hover:text-zinc-900"
            )}
          >
            <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
            {tab.name}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
      >
        <Menu className="h-5 w-5" />
        Menu
      </button>
    </nav>
  );
}
