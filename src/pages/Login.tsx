import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Store } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { useBrandingStore } from "../store/branding";
import { useThemeStore } from "../store/theme";
import { cn } from "../lib/utils";

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginError, signInWithGoogle, signInWithPassword, loadSession } = useAuthStore();
  const branding = useBrandingStore((state) => state.branding);
  const themeId = useThemeStore((state) => state.themeId);
  const isMoss = themeId === "moss";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    useThemeStore.getState().loadTheme();
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
    <div className={cn(
      "flex min-h-screen items-center justify-center p-4",
      isMoss ? "bg-[#122E29]" : "bg-gray-50"
    )}>
      <div className={cn(
        "w-full max-w-md p-6 sm:p-8",
        isMoss
          ? "rounded-[var(--radius-dialog)] border border-white/10 bg-white/[0.06] shadow-[var(--shadow-dialog)] backdrop-blur-xl"
          : "rounded-lg border border-gray-200 bg-white shadow-sm"
      )}>
        <div className="mb-6 flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center overflow-hidden rounded-[var(--radius-control)]",
            isMoss ? "bg-[#E9B44C] text-[#122E29]" : "bg-emerald-600 text-white"
          )}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className={cn("text-xl font-semibold", isMoss ? "text-white" : "text-gray-900")}>{branding.appName}</h1>
            <p className={cn("text-sm", isMoss ? "text-white/60" : "text-gray-500")}>{branding.appDescription}</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className={cn("text-sm", isMoss ? "text-white/70" : "text-gray-600")}>
            Đăng nhập bằng Google hoặc email/mật khẩu. Email phải được admin thêm và kích hoạt trong hệ thống.
          </p>
          {loginError && (
            <div className={cn(
              "p-3 text-sm",
              isMoss ? "rounded-[var(--radius-control)] bg-red-500/15 text-red-200" : "rounded-md bg-red-50 text-red-700"
            )}>{loginError}</div>
          )}

          <form onSubmit={submitPasswordLogin} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className={cn(
                "w-full px-3 py-2 text-sm outline-none",
                isMoss
                  ? "rounded-[var(--radius-control)] border border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:border-[#E9B44C]"
                  : "rounded-md border border-gray-300 focus:border-emerald-600"
              )}
              autoComplete="email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mật khẩu"
              className={cn(
                "w-full px-3 py-2 text-sm outline-none",
                isMoss
                  ? "rounded-[var(--radius-control)] border border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:border-[#E9B44C]"
                  : "rounded-md border border-gray-300 focus:border-emerald-600"
              )}
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 px-4 py-2 font-medium",
                isMoss
                  ? "rounded-[var(--radius-control)] bg-[#E9B44C] text-[#122E29] hover:bg-[#DFA636] disabled:bg-white/10 disabled:text-white/40"
                  : "rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
              )}
            >
              <KeyRound className="h-4 w-4" />
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập bằng email"}
            </button>
          </form>

          <div className={cn("flex items-center gap-3 text-xs", isMoss ? "text-white/40" : "text-gray-400")}>
            <div className={cn("h-px flex-1", isMoss ? "bg-white/15" : "bg-gray-200")} />
            <span>hoặc</span>
            <div className={cn("h-px flex-1", isMoss ? "bg-white/15" : "bg-gray-200")} />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isLoading}
            className={cn(
              "w-full px-4 py-2 font-medium",
              isMoss
                ? "rounded-[var(--radius-control)] border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                : "rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
            )}
          >
            Đăng nhập bằng Google
          </button>
        </div>
      </div>
    </div>
  );
}
