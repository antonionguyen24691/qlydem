import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { detectPwaInstallContext, type PwaInstallContext } from "./install";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_AT_KEY = "pmql-pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isRecentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

function getInstallContext(): PwaInstallContext {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return detectPwaInstallContext({
    userAgent: window.navigator.userAgent,
    platform: window.navigator.platform,
    maxTouchPoints: window.navigator.maxTouchPoints,
    isStandalone
  });
}

export function PwaInstallPrompt() {
  const [context, setContext] = useState<PwaInstallContext>("installed");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    setContext(getInstallContext());
    setIsDismissed(isRecentlyDismissed());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setIsDismissed(isRecentlyDismissed());
    }

    function onInstalled() {
      setContext("installed");
      setInstallPrompt(undefined);
      window.localStorage.removeItem(DISMISSED_AT_KEY);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (context === "installed" || isDismissed || (context === "browser" && !installPrompt)) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setIsDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setContext("installed");
    setInstallPrompt(undefined);
  }

  return (
    <section
      aria-label="Cài đặt ứng dụng PMQL"
      className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[100] mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl lg:bottom-[max(12px,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Đóng hướng dẫn cài đặt"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="pr-11">
        <div className="font-bold text-zinc-900">Cài PMQL trên thiết bị</div>
        {context === "ios" ? (
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Trong Safari, nhấn <Share className="mx-1 inline h-4 w-4" aria-hidden="true" />
            <strong>Chia sẻ</strong>, rồi chọn <strong>Thêm vào Màn hình chính</strong>.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Cài ứng dụng để mở nhanh như một app riêng trên điện thoại hoặc máy tính bảng.
          </p>
        )}
      </div>

      {context === "browser" && (
        <button
          type="button"
          onClick={install}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          <Download className="h-5 w-5" />
          Cài ứng dụng
        </button>
      )}
    </section>
  );
}
