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
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
        isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
      )}>
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b">
          <div className={cn("flex items-center gap-2 font-bold text-xl text-[#006B68] overflow-hidden transition-all", !isSidebarOpen && "lg:justify-center lg:w-full")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#006B68] text-white">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-cover" />
              ) : (
                <Store size={22} />
              )}
            </div>
            <span className={cn("truncate whitespace-nowrap transition-opacity duration-200", !isSidebarOpen && "lg:hidden lg:opacity-0")}>
              {branding.appName}
            </span>
          </div>
          <button 
            className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={!isSidebarOpen ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors group",
                    isActive 
                      ? "bg-[#006B68]/10 text-[#006B68]" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                    !isSidebarOpen && "lg:justify-center"
                  )}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-[#006B68]" : "text-gray-400 group-hover:text-gray-900")} />
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
