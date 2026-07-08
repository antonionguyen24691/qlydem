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
  X
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store/ui";
import { useBrandingStore } from "../../store/branding";

const navItems = [
  { name: "Tổng quan", href: "/", icon: LayoutDashboard },
  { name: "Bán hàng (POS)", href: "/pos", icon: ShoppingCart },
  { name: "Đơn hàng", href: "/orders", icon: FileText },
  { name: "Sản phẩm", href: "/products", icon: Package },
  { name: "Tồn kho", href: "/inventory", icon: Store },
  { name: "Khách hàng", href: "/customers", icon: Users },
  { name: "Tài chính", href: "/finance", icon: BadgeDollarSign },
  { name: "Cấu hình", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const branding = useBrandingStore((state) => state.branding);

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
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 shadow-xl lg:shadow-none",
        isSidebarOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full lg:w-20 lg:translate-x-0"
      )}>
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-zinc-100">
          <div className={cn("flex items-center gap-3 font-semibold text-zinc-900 overflow-hidden transition-all", !isSidebarOpen && "lg:justify-center lg:w-full")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-white shadow-sm ring-1 ring-inset ring-zinc-900/10">
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
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors active:scale-95"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden hide-scrollbar">
          <nav className="space-y-1.5 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={!isSidebarOpen ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm transition-all group relative overflow-hidden",
                    isActive 
                      ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm ring-1 ring-inset ring-zinc-200/50" 
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium",
                    !isSidebarOpen && "lg:justify-center"
                  )}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <item.icon className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors", 
                    isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
                  )} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={cn("whitespace-nowrap transition-opacity duration-200", !isSidebarOpen && "lg:hidden lg:opacity-0")}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
