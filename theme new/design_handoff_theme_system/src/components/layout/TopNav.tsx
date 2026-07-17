import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, CheckCheck, Menu, Search, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store/ui";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore } from "../../store/branding";
import { getAuthHeaders } from "../../lib/supabase";
import { canManageInventory, canManageProducts, canSell, canViewCustomers, canViewFinance, canViewSuppliers, isAdmin } from "../../lib/permissions";

/**
 * TopNav — thanh điều hướng ngang cho theme "terracotta" (1b).
 * Thay thế cặp Sidebar + Topbar trên desktop; trên mobile (<lg) chỉ hiển thị
 * logo + chuông + nút menu (mở Sidebar drawer, điều hướng chính nằm ở BottomTabBar).
 * Giữ nguyên đầy đủ tính năng của Topbar hiện tại: thông báo (poll 60s,
 * đánh dấu đã đọc), tìm kiếm F3, đăng xuất, branding, permissions.
 */

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  type?: string;
  readAt?: string | null;
  createdAt?: string;
  href?: string;
};

const navItems = [
  { name: "Tổng quan", href: "/", visible: () => true },
  { name: "Bán hàng", href: "/pos", visible: canSell },
  { name: "Đơn hàng", href: "/orders", visible: canSell },
  { name: "Sản phẩm", href: "/products", visible: (user: any) => canManageProducts(user) || canSell(user) || canViewFinance(user) },
  { name: "Kho", href: "/inventory", visible: (user: any) => canManageInventory(user) || user?.role === "SALE" },
  { name: "Khách hàng", href: "/customers", visible: canViewCustomers },
  { name: "NCC", href: "/suppliers", visible: canViewSuppliers },
  { name: "Tài chính", href: "/finance", visible: canViewFinance },
  { name: "Cấu hình", href: "/settings", visible: isAdmin }
];

export function TopNav() {
  const location = useLocation();
  const { toggleSidebar } = useUIStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const branding = useBrandingStore((state) => state.branding);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const notificationRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    if (!isAuthenticated) return;
    const response = await fetch("/api/data/app-notifications", {
      headers: await getAuthHeaders()
    });
    const body = await response.json();
    if (!response.ok || !body.ok) return;
    const visibleItems = (body.items ?? []).filter((item: NotificationItem) => !item.readAt && !dismissedIds.has(item.id));
    setNotifications(visibleItems);
    setUnreadCount(visibleItems.length);
  }

  async function markRead(id?: string) {
    const idsToDismiss = id ? [id] : notifications.map((item) => item.id);
    setDismissedIds((current) => new Set([...current, ...idsToDismiss]));
    setNotifications((current) => id ? current.filter((item) => item.id !== id) : []);
    setUnreadCount((current) => id ? Math.max(0, current - 1) : 0);
    await fetch("/api/data/app-notifications", {
      method: "PATCH",
      headers: {
        ...(await getAuthHeaders()),
        "content-type": "application/json"
      },
      body: JSON.stringify({ id })
    });
    await loadNotifications();
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, dismissedIds]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 sm:px-6">
      {/* Nút menu mobile — mở Sidebar drawer */}
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 rounded-full lg:hidden focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-lg bg-emerald-600 text-white text-sm font-bold">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-cover" />
          ) : (
            (branding.appName || "P").charAt(0)
          )}
        </div>
        <span className="font-bold tracking-tight text-zinc-900">{branding.appName}</span>
      </Link>

      {/* Nav ngang — desktop */}
      <nav className="hidden lg:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto hide-scrollbar">
        {navItems.filter((item) => item.visible(user)).map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-zinc-900 text-zinc-50 font-bold"
                  : "text-zinc-600 hover:bg-zinc-100 font-medium"
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 lg:hidden" />

      {/* Tìm kiếm */}
      <div className="relative hidden sm:block shrink-0">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-zinc-400" />
        </div>
        <input
          type="text"
          className="block w-[190px] rounded-full border-0 py-1.5 pl-9 pr-3 text-sm text-zinc-900 bg-white ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600"
          placeholder="Tìm kiếm (F3)"
        />
      </div>

      {/* Thông báo */}
      <div className="relative shrink-0" ref={notificationRef}>
        <button
          type="button"
          onClick={() => setIsNotificationsOpen((value) => !value)}
          className="relative p-2 text-zinc-500 hover:bg-zinc-100 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-600"
          title="Thông báo"
        >
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-zinc-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <Bell className="h-[18px] w-[18px]" />
        </button>

        {isNotificationsOpen && (
          <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <div className="font-bold text-zinc-900">Thông báo</div>
                <div className="text-xs text-zinc-500">{unreadCount} việc cần xử lý</div>
              </div>
              <button
                type="button"
                onClick={() => markRead()}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCheck className="h-4 w-4" />
                Đã đọc
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={async () => {
                    await markRead(item.id);
                    setIsNotificationsOpen(false);
                    if (item.href) window.location.href = item.href;
                  }}
                  className="block w-full border-b border-zinc-100 px-4 py-3 text-left last:border-b-0 hover:bg-zinc-50"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 rounded-full ${item.readAt ? "bg-zinc-300" : "bg-red-600"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-zinc-900">{item.title}</div>
                      {item.body && <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.body}</div>}
                      {item.createdAt && (
                        <div className="mt-2 text-xs text-zinc-400">{new Date(item.createdAt).toLocaleString("vi-VN")}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">Chưa có thông báo mới.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Đăng xuất */}
      <button
        type="button"
        onClick={logout}
        className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-80 text-left"
        title="Đăng xuất"
      >
        <div className="h-8 w-8 rounded-full bg-zinc-900 text-zinc-50 flex items-center justify-center">
          {user?.fullName ? (
            <span className="text-[13px] font-bold">{user.fullName.charAt(0).toUpperCase()}</span>
          ) : (
            <User className="h-4 w-4" />
          )}
        </div>
        <div className="hidden xl:block text-sm">
          <div className="font-medium text-zinc-700">{user?.fullName ?? "Admin"}</div>
          <div className="text-xs text-zinc-500">{user?.role ?? "ADMIN"}</div>
        </div>
      </button>
    </header>
  );
}
