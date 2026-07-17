import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { themes, type ThemeId } from "../../theme/themes";
import { isAdmin } from "../../lib/permissions";

/**
 * ThemeSettingsSection — mục "Giao diện (theme)" trong trang Cấu hình.
 * Chỉ ADMIN thấy và lưu được (API kiểm quyền settings.manage).
 * Chọn thẻ = preview ngay toàn app (chưa lưu); Lưu = áp cho mọi người dùng;
 * Hủy = quay về theme đã lưu.
 *
 * Tích hợp: import và render <ThemeSettingsSection /> trong src/pages/Settings.tsx,
 * đặt cạnh mục "Nhận diện app" (branding).
 */
export function ThemeSettingsSection() {
  const user = useAuthStore((state) => state.user);
  const { themeId, savedThemeId, isSavingTheme, themeError, setThemeLocal, revertTheme, saveTheme } = useThemeStore();
  const [message, setMessage] = useState("");
  const isDirty = themeId !== savedThemeId;

  if (!isAdmin(user)) return null;

  async function handleSave() {
    setMessage("");
    try {
      await saveTheme(themeId as ThemeId);
      setMessage("Đã lưu giao diện. Theme áp dụng cho tất cả người dùng.");
    } catch {
      /* themeError đã được store set */
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-zinc-900">Giao diện (theme)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Chọn để xem trước ngay trên toàn ứng dụng. Bấm Lưu để áp dụng cho mọi người dùng.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {themes.map((theme) => {
          const isSelected = themeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => { setMessage(""); setThemeLocal(theme.id); }}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-all",
                isSelected ? "border-emerald-600 shadow-sm" : "border-zinc-200 hover:border-zinc-300"
              )}
            >
              {/* Preview thu nhỏ */}
              <div className="h-24 overflow-hidden rounded-lg border border-zinc-200" style={{ background: theme.preview.bg }}>
                <div className="flex h-full">
                  {theme.layout === "sidebar" ? (
                    <div className="w-1/4 shrink-0" style={{ background: theme.id === "moss" ? theme.preview.ink : theme.preview.surface }} />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
                    {theme.layout === "topnav" && (
                      <div className="h-2.5 rounded-sm" style={{ background: theme.preview.surface, border: "1px solid rgba(0,0,0,0.06)" }} />
                    )}
                    <div className="h-4 w-2/3 rounded-sm" style={{ background: theme.preview.primary }} />
                    <div className="flex gap-1.5">
                      <div className="h-8 flex-1 rounded-sm" style={{ background: theme.preview.surface, border: "1px solid rgba(0,0,0,0.06)" }} />
                      <div className="h-8 flex-1 rounded-sm" style={{ background: theme.preview.surface, border: "1px solid rgba(0,0,0,0.06)" }} />
                    </div>
                    <div className="h-2 w-1/3 rounded-sm" style={{ background: theme.preview.accent }} />
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">{theme.name}</div>
                  <div className="truncate text-xs text-zinc-500">{theme.description}</div>
                </div>
                {isSelected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSavingTheme}
          className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSavingTheme ? "Đang lưu..." : "Lưu giao diện"}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={() => { setMessage(""); revertTheme(); }}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Hủy xem trước
          </button>
        )}
        {message && <span className="text-sm text-emerald-700">{message}</span>}
        {themeError && <span className="text-sm text-red-600">{themeError}</span>}
      </div>
    </section>
  );
}
