import { Navigate, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useEffect } from "react";
import { useAuthStore } from "../store/auth";
import { useBrandingStore } from "../store/branding";

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginError, signInWithGoogle, loadSession } = useAuthStore();
  const branding = useBrandingStore((state) => state.branding);

  if (isAuthenticated) return <Navigate to="/" replace />;

  useEffect(() => {
    loadSession().then(() => {
      if (useAuthStore.getState().isAuthenticated) navigate("/", { replace: true });
    });
  }, [loadSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#006B68] text-white">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{branding.appName}</h1>
            <p className="text-sm text-gray-500">{branding.appDescription}</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Đăng nhập bằng Google. Email phải được admin thêm trong bảng `users` của Supabase.
          </p>
          {loginError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loginError}</div>}
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isLoading}
            className="w-full rounded-md bg-[#006B68] px-4 py-2 font-medium text-white hover:bg-[#005a57] disabled:bg-gray-300"
          >
            {isLoading ? "Đang kiểm tra phiên..." : "Đăng nhập bằng Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
