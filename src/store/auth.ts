import { create } from "zustand";
import { assertSupabaseConfigured, supabase } from "../lib/supabase";
import { getAuthHeaders } from "../lib/supabase";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  permissions: Record<string, "none" | "own" | "department" | "all">;
};

type AuthStore = {
  user?: AuthUser;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError?: string;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  loadSession: () => Promise<void>;
  logout: () => Promise<void>;
};

async function fetchProfile() {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw new Error("Chưa có phiên đăng nhập Supabase.");

  const response = await fetch("/api/auth/me", { headers });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error ?? "Không đọc được hồ sơ người dùng.");
  return body.user as AuthUser;
}

function formatAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Không đăng nhập được";
  if (message.toLowerCase().includes("invalid api key")) {
    return "Supabase API key trên Vercel chưa hợp lệ. Hãy thay bằng anon public key và service_role key thật trong Supabase Dashboard.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Không kết nối được Supabase. Hãy kiểm tra URL Supabase và cấu hình mạng.";
  }
  return message;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: undefined,
  isAuthenticated: false,
  isLoading: true,
  signInWithGoogle: async () => {
    set({ isLoading: true, loginError: undefined });
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      set({ isLoading: false, loginError: formatAuthError(error) });
    }
  },
  signInWithPassword: async (email, password) => {
    set({ isLoading: true, loginError: undefined });
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (error) throw error;
      const user = await fetchProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({
        user: undefined,
        isAuthenticated: false,
        isLoading: false,
        loginError: formatAuthError(error)
      });
    }
  },
  loadSession: async () => {
    set({ isLoading: true, loginError: undefined });
    try {
      assertSupabaseConfigured();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        set({ user: undefined, isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await fetchProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({
        user: undefined,
        isAuthenticated: false,
        isLoading: false,
        loginError: formatAuthError(error)
      });
    }
  },
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: undefined, isAuthenticated: false, isLoading: false });
  }
}));
