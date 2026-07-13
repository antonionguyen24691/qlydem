import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  Store,
  FileText,
  BadgeDollarSign,
  Truck,
  X
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store/ui";
import { useBrandingStore } from "../../store/branding";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { themesById } from "../../theme/themes";
import { canManageInventory, canManageProducts, canSell, canViewCustomers, canViewFinance, canViewSuppliers, isAdmin } from "../../lib/permissions";

/**
 * Sidebar theme-aware — thay thế src/components/layout/Sidebar.tsx.
 * - variant "light": giữ nguyên giao diện hiện tại (classic).
 * - variant "dark" (theme moss): nền xanh rêu đậm #122E29, nav phân nhóm,
 *   item active có vệt vàng đồng bên trái.
 * - prop mobileOnly: dùng ở layout topnav (terracotta) — sidebar chỉ còn là
 *   drawer trên mobile, desktop dùng TopNav.
 * Toàn bộ logic (permissions, branding, đóng mở mobile) giữ nguyên.
 */

const navGroups = [
  {
    label: "Vận hành",
    items: [
      { name: "Tổng quan", href: "/", icon: LayoutDashboard, visible: () => true },
      { name: "Bán hàng (POS)", href: "/pos", icon: ShoppingCart, visible: canSell },
      { name: "Đơn hàng", href: "/orders", icon: FileText, visible: canSell },
      { name: "Sản phẩm", href: "/products", icon: Package, visible: (user: any) => canManageProducts(user) || canSell(user) || canViewFinance(user) },
      { name: "Tồn kho", href: "/inventory", icon: Store, visible: (user: any) => canManageInventory(user) || user?.role === "SALE" }
    ]
  },
  {
    label: "Đối tác",
    items: [
      { name: "Khách hàng", href: "/customers", icon: Users, visible: canViewCustomers },
      { name: "Nhà cung cấp", href: "/suppliers", icon: Truck, visible: canViewSuppliers }
    ]
  },
  {
    label: "Tài chính",
    items: [
      { name: "Báo cáo tài chính", href: "/finance", icon: BadgeDollarSign, visible: canViewFinance },
      { name: "Cấu hình", href: "/settings", icon: Settings, visible: isAdmin }
    ]
  }
];

export function Sidebar({ mobileOnly = false }: { mobileOnly?: boolean }) {
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const branding = useBrandingStore((state) => state.branding);
  const user = useAuthStore((state) => state.user);
  const themeId = useThemeStore((state) => state.themeId);
  const dark = (themesById[themeId]?.sidebarVariant ?? "light") === "dark";

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible(user)) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out lg:static lg:translate-x-0 shadow-xl lg:shadow-none",
        dark ? "bg-[#122E29] text-[#E8EDE9]" : "bg-white border-r border-zinc-200",
        isSidebarOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full lg:w-20 lg:translate-x-0",
        mobileOnly && "lg:hidden"
      )} data-sidebar-theme={themeId}>
        <div className={cn(
          "flex h-16 shrink-0 items-center justify-between px-4",
          dark ? "border-b border-white/10" : "border-b border-zinc-100"
        )}>
          <div className={cn("flex items-center gap-3 font-semibold overflow-hidden transition-all", dark ? "text-white" : "text-zinc-900", !isSidebarOpen && "lg:justify-center lg:w-full")}>
            <div className={cn(
              "sidebar-logo flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm",
              dark ? "bg-[#E9B44C] text-[#122E29]" : "bg-zinc-900 text-white ring-1 ring-inset ring-zinc-900/10"
            )}>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-cover" />
              ) : (
                <Store size={18} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn("truncate whitespace-nowrap tracking-tight transition-opacity duration-200 text-base", !isSidebarOpen && "lg:hidden lg:opacity-0")}>
              {branding.appName}
            </span>
          </div>
          <button
            className={cn(
              "lg:hidden p-2 rounded-lg transition-colors active:scale-95",
              dark ? "text-[#9DB5AC] hover:text-white hover:bg-white/10" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
            )}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden hide-scrollbar">
          <nav className="space-y-1.5 px-3">
            {groups.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && "pt-3")}>
                {dark && isSidebarOpen && (
                  <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5E7F76]">
                    {group.label}
                  </div>
                )}
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        title={!isSidebarOpen ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm transition-all group relative overflow-hidden",
                          dark
                            ? isActive
                              ? "bg-[#E9B44C]/15 text-white font-bold shadow-[inset_2px_0_0_#E9B44C]"
                              : "text-[#9DB5AC] hover:bg-white/5 hover:text-[#E8EDE9] font-medium"
                            : isActive
                              ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm ring-1 ring-inset ring-zinc-200/50"
                              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium",
                          !isSidebarOpen && "lg:justify-center"
                        )}
                        data-active={isActive}
                        onClick={() => {
                          if (window.innerWidth < 1024) {
                            setSidebarOpen(false);
                          }
                        }}
                      >
                        <item.icon className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          dark
                            ? isActive ? "text-[#E9B44C]" : "text-[#7FA096] group-hover:text-[#E8EDE9]"
                            : isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
                        )} strokeWidth={isActive ? 2.5 : 2} />
                        <span className={cn("whitespace-nowrap transition-opacity duration-200", !isSidebarOpen && "lg:hidden lg:opacity-0")}>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
