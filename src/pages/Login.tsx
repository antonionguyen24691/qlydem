import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Store } from "lucide-react";
import { useAuthStore } from "../store/auth";

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, loginError, verifySecret } = useAuthStore();
  const [secret, setSecret] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const ok = await verifySecret(secret);
    setIsSubmitting(false);
    if (ok) navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-[#006B68] p-2 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">CRM QLBH</h1>
            <p className="text-sm text-gray-500">Đăng nhập quản trị bootstrap</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Internal API Secret</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#006B68] focus:ring-1 focus:ring-[#006B68]"
                placeholder="Nhập INTERNAL_API_SECRET"
                required
              />
            </div>
          </div>
          {loginError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loginError}</div>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#006B68] px-4 py-2 font-medium text-white hover:bg-[#005a57] disabled:bg-gray-300"
          >
            {isSubmitting ? "Đang kiểm tra..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
