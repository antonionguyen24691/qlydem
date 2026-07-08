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

  if (isLoading) return <div className="flex h-screen items-center justify-center text-sm text-gray-500">Đang kiểm tra đăng nhập...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 relative">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar />
        {(liveDataError || isLoadingLiveData) && (
          <div className={`border-b px-4 py-2 text-sm ${liveDataError ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
            {liveDataError ? `Chưa kết nối được dữ liệu thật: ${liveDataError}` : "Đang tải dữ liệu thật từ Supabase..."}
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
