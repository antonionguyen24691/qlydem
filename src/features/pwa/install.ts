export type PwaInstallContext = "installed" | "ios" | "browser";

type InstallEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  isStandalone: boolean;
};

export function detectPwaInstallContext(environment: InstallEnvironment): PwaInstallContext {
  if (environment.isStandalone) return "installed";

  const isIosDevice = /iPad|iPhone|iPod/i.test(environment.userAgent);
  const isIpadDesktopMode = environment.platform === "MacIntel" && environment.maxTouchPoints > 1;
  return isIosDevice || isIpadDesktopMode ? "ios" : "browser";
}
