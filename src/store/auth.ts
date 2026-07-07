import { create } from "zustand";

type AuthUser = {
  id: string;
  name: string;
  role: string;
};

type AuthStore = {
  secret: string;
  user?: AuthUser;
  isAuthenticated: boolean;
  loginError?: string;
  setSecret: (secret: string) => void;
  verifySecret: (secret?: string) => Promise<boolean>;
  logout: () => void;
};

const storedSecret = localStorage.getItem("crm.internalSecret") ?? "";
const storedUser = localStorage.getItem("crm.user");

export const useAuthStore = create<AuthStore>((set, get) => ({
  secret: storedSecret,
  user: storedUser ? JSON.parse(storedUser) : undefined,
  isAuthenticated: Boolean(storedSecret && storedUser),
  setSecret: (secret) => {
    localStorage.setItem("crm.internalSecret", secret);
    set({ secret });
  },
  verifySecret: async (inputSecret) => {
    const secret = inputSecret ?? get().secret;
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": secret
        }
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Secret không hợp lệ");
      localStorage.setItem("crm.internalSecret", secret);
      localStorage.setItem("crm.user", JSON.stringify(body.user));
      set({ secret, user: body.user, isAuthenticated: true, loginError: undefined });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xác thực được";
      localStorage.removeItem("crm.user");
      set({ isAuthenticated: false, user: undefined, loginError: message });
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem("crm.user");
    localStorage.removeItem("crm.internalSecret");
    set({ secret: "", user: undefined, isAuthenticated: false });
  }
}));
