import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

/**
 * Banner "có bản cập nhật mới" — registerType: 'prompt' trong vite.config.ts
 * nghĩa là service worker mới cài xong sẽ CHỜ, không tự thay bản đang chạy.
 * Không có UI này thì người dùng quay lại app sẽ kẹt ở bản cache cũ vô thời
 * hạn dù đã deploy bản mới (đặt ở trên đầu màn hình để không đụng
 * PwaInstallPrompt/BottomTabBar/thanh thanh toán POS đều ở dưới đáy).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    }
  });

  if (!needRefresh) return null;

  return (
    <section
      aria-label="Có bản cập nhật mới"
      className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[110] mx-auto max-w-lg rounded-[var(--radius-dialog)] border border-emerald-200 bg-white p-4 shadow-[var(--shadow-dialog)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-zinc-900">Có bản cập nhật mới</div>
          <p className="text-sm text-zinc-600">Tải lại để dùng đúng phiên bản mới nhất.</p>
        </div>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-[var(--radius-control)] bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Tải lại
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Để sau"
          className="shrink-0 rounded-[var(--radius-control)] p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
