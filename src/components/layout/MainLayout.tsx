import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TopNav } from "./TopNav";
import { BottomTabBar } from "./BottomTabBar";
import { useDataStore } from "../../store/data";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { themesById } from "../../theme/themes";
import { cn } from "../../lib/utils";

/**
 * MainLayout theme-aware.
 * - layout "sidebar" (classic, moss): Sidebar + Topbar như cũ.
 * - layout "topnav" (terracotta): TopNav ngang; Sidebar chỉ còn là drawer mobile.
 * - Mobile (<lg): thêm BottomTabBar cho mọi theme, trừ "/pos" (trang này đã có
 *   sẵn thanh cart/checkout cố định + drawer thanh toán riêng — xem POS.tsx).
 * Toàn bộ luồng auth/loadLiveData giữ nguyên.
 */
export function MainLayout() {
  const location = useLocation();
  const { loadLiveData, liveDataError, isLoadingLiveData } = useDataStore();
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const { themeId, loadTheme } = useThemeStore();
  const layout = themesById[themeId]?.layout ?? "sidebar";
  const hasBottomTabBar = location.pathname !== "/pos";

  useEffect(() => {
    loadSession();
    loadTheme();
  }, [loadSession, loadTheme]);

  useEffect(() => {
    if (isAuthenticated) loadLiveData();
  }, [isAuthenticated, loadLiveData]);

  if (isLoading) return <div className="flex h-screen items-center justify-center text-sm text-zinc-500 bg-zinc-50">Đang kiểm tra đăng nhập...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 relative selection:bg-emerald-100 selection:text-emerald-900">
      <Sidebar mobileOnly={layout === "topnav"} />
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", location.pathname === "/pos" && "pos-route-shell")}>
        {layout === "topnav" ? <TopNav /> : <Topbar />}
        {(liveDataError || isLoadingLiveData) && (
          <div className={`border-b px-4 py-2 text-sm ${liveDataError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {liveDataError ? `Chưa đồng bộ được dữ liệu: ${liveDataError}` : "Đang đồng bộ dữ liệu..."}
          </div>
        )}
        <main className={cn("min-h-0 flex-1 overflow-y-auto custom-scrollbar", hasBottomTabBar && "pb-16 lg:pb-0")}>
          <Outlet />
        </main>
      </div>
      {hasBottomTabBar && <BottomTabBar />}
    </div>
  );
}
