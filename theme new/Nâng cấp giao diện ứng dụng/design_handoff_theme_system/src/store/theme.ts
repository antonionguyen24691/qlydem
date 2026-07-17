import { create } from "zustand";
import { getAuthHeaders } from "../lib/supabase";
import { defaultThemeId, isThemeId, themesById, type ThemeId } from "../theme/themes";

const STORAGE_KEY = "pmql-theme";

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* storage bị chặn — bỏ qua */
  }
  return defaultThemeId;
}

/** Gắn data-theme lên <html> + nạp font của theme (idempotent). */
export function applyTheme(themeId: ThemeId) {
  const theme = themesById[themeId] ?? themesById[defaultThemeId];
  if (theme.id === "classic") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme.id;
  }
  for (const href of theme.fontLinks) {
    if (!document.querySelector(`link[data-theme-font="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-theme-font", href);
      document.head.appendChild(link);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* bỏ qua */
  }
}

type ThemeStore = {
  /** Theme đang hiển thị (có thể là preview chưa lưu) */
  themeId: ThemeId;
  /** Theme đã lưu trên server */
  savedThemeId: ThemeId;
  isLoadingTheme: boolean;
  isSavingTheme: boolean;
  themeError?: string;
  /** Đổi theme tại chỗ (preview ngay, chưa lưu) */
  setThemeLocal: (themeId: ThemeId) => void;
  /** Quay về theme đã lưu (hủy preview) */
  revertTheme: () => void;
  /** Tải theme đã cấu hình từ /api/settings?key=appearance */
  loadTheme: () => Promise<void>;
  /** Lưu theme (yêu cầu quyền settings.manage — ADMIN) */
  saveTheme: (themeId: ThemeId) => Promise<void>;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  themeId: readStoredTheme(),
  savedThemeId: readStoredTheme(),
  isLoadingTheme: false,
  isSavingTheme: false,

  setThemeLocal: (themeId) => {
    applyTheme(themeId);
    set({ themeId });
  },

  revertTheme: () => {
    const saved = get().savedThemeId;
    applyTheme(saved);
    set({ themeId: saved });
  },

  loadTheme: async () => {
    if (get().isLoadingTheme) return;
    set({ isLoadingTheme: true, themeError: undefined });
    try {
      const response = await fetch("/api/settings?key=appearance");
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được cấu hình giao diện");
      const themeId = isThemeId(body.appearance?.themeId) ? body.appearance.themeId : defaultThemeId;
      applyTheme(themeId);
      set({ themeId, savedThemeId: themeId, isLoadingTheme: false });
    } catch (error) {
      // Giữ theme từ localStorage để không nháy giao diện khi offline
      applyTheme(get().themeId);
      set({
        isLoadingTheme: false,
        themeError: error instanceof Error ? error.message : "Không tải được cấu hình giao diện"
      });
    }
  },

  saveTheme: async (themeId) => {
    set({ isSavingTheme: true, themeError: undefined });
    try {
      const response = await fetch("/api/settings?key=appearance", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({ themeId })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được cấu hình giao diện");
      const saved = isThemeId(body.appearance?.themeId) ? body.appearance.themeId : themeId;
      applyTheme(saved);
      set({ themeId: saved, savedThemeId: saved, isSavingTheme: false });
    } catch (error) {
      set({ isSavingTheme: false, themeError: error instanceof Error ? error.message : "Không lưu được cấu hình giao diện" });
      throw error;
    }
  }
}));

// Áp theme từ localStorage ngay khi module được nạp (tránh nháy màu lúc khởi động)
if (typeof document !== "undefined") {
  applyTheme(readStoredTheme());
}
