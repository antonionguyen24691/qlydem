import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Store } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { useBrandingStore } from "../store/branding";

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginError, signInWithGoogle, signInWithPassword, loadSession } = useAuthStore();
  const branding = useBrandingStore((state) => state.branding);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    loadSession().then(() => {
      if (useAuthStore.getState().isAuthenticated) navigate("/", { replace: true });
    });
  }, [loadSession, navigate]);

  const submitPasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
    await signInWithPassword(email, password);
    if (useAuthStore.getState().isAuthenticated) navigate("/", { replace: true });
  };

  if (isAuthenticated) return <Navigate to="/" replace />;

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
            Đăng nhập bằng Google hoặc email/mật khẩu. Email phải được admin thêm và kích hoạt trong hệ thống.
          </p>
          {loginError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loginError}</div>}

          <form onSubmit={submitPasswordLogin} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
              autoComplete="email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mật khẩu"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#006B68] px-4 py-2 font-medium text-white hover:bg-[#005a57] disabled:bg-gray-300"
            >
              <KeyRound className="h-4 w-4" />
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập bằng email"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>hoặc</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isLoading}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
          >
            Đăng nhập bằng Google
          </button>
        </div>
      </div>
    </div>
  );
}
