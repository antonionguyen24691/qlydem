import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useDataStore } from "../../store/data";
import { useAuthStore } from "../../store/auth";

export function MainLayout() {
  const { loadLiveData, liveDataError, isLoadingLiveData } = useDataStore();
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (isAuthenticated) loadLiveData();
  }, [isAuthenticated, loadLiveData]);

  if (isLoading) return <div className="flex h-screen items-center justify-center text-sm text-zinc-500 bg-zinc-50">Đang kiểm tra đăng nhập...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 relative selection:bg-emerald-100 selection:text-emerald-900">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar />
        {(liveDataError || isLoadingLiveData) && (
          <div className={`border-b px-4 py-2 text-sm ${liveDataError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {liveDataError ? `Chưa đồng bộ được dữ liệu: ${liveDataError}` : "Đang đồng bộ dữ liệu..."}
          </div>
        )}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
