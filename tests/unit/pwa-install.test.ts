import { describe, expect, it } from "vitest";
import { detectPwaInstallContext } from "../../src/features/pwa/install";

describe("PWA install context", () => {
  it("recognizes iPhone Safari as an iOS install candidate", () => {
    expect(detectPwaInstallContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
      isStandalone: false
    })).toBe("ios");
  });

  it("recognizes iPadOS desktop user agents", () => {
    expect(detectPwaInstallContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      platform: "MacIntel",
      maxTouchPoints: 5,
      isStandalone: false
    })).toBe("ios");
  });

  it("does not offer installation inside an installed app", () => {
    expect(detectPwaInstallContext({
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      isStandalone: true
    })).toBe("installed");
  });

  it("uses the browser install flow outside iOS", () => {
    expect(detectPwaInstallContext({
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      isStandalone: false
    })).toBe("browser");
  });
});
