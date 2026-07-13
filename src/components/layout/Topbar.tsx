import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Search, User, Menu, CheckCheck } from "lucide-react";
import { useUIStore } from "../../store/ui";
import { useAuthStore } from "../../store/auth";
import { getAuthHeaders } from "../../lib/supabase";

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  type?: string;
  readAt?: string | null;
  createdAt?: string;
  href?: string;
};

export function Topbar() {
  const location = useLocation();
  const { toggleSidebar } = useUIStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const notificationRef = useRef<HTMLDivElement>(null);
  const pageTitle = {
    "/": "Tổng quan",
    "/pos": "Bán hàng mới",
    "/orders": "Nhật ký bán hàng",
    "/products": "Danh mục hàng hóa",
    "/inventory": "Quản lý tồn kho",
    "/customers": "Khách hàng",
    "/suppliers": "Nhà cung cấp",
    "/finance": "Báo cáo tài chính",
    "/expenses": "Báo cáo tài chính",
    "/settings": "Cấu hình"
  }[location.pathname] ?? (location.pathname.startsWith("/orders/") ? "Phiếu xuất bán hàng" : "PMQL");

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
    <header className="app-chrome-header relative flex h-16 items-center justify-between border-b bg-white px-4 shrink-0">
      <div className="pointer-events-none absolute inset-x-16 flex justify-center sm:inset-x-48">
        <h1 className="max-w-full truncate text-center text-base font-bold text-zinc-900 sm:text-lg">{pageTitle}</h1>
      </div>
      <div className="flex flex-1 items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative w-full max-w-md hidden sm:block">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
            placeholder="Tìm kiếm thông tin (F3)..." 
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((value) => !value)}
            className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 rounded-md"
            title="Thông báo"
          >
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <Bell className="h-5 w-5" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
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
                      <span className={`mt-1 h-2 w-2 rounded-full ${item.readAt ? "bg-zinc-300" : "bg-red-500"}`} />
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
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 border-l pl-4 cursor-pointer hover:opacity-80 text-left"
          title="Đăng xuất"
        >
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <div className="hidden md:block text-sm">
            <div className="font-medium text-gray-700">{user?.fullName ?? "Admin"}</div>
            <div className="text-xs text-gray-500">{user?.role ?? "ADMIN"}</div>
          </div>
        </button>
      </div>
    </header>
  );
}
