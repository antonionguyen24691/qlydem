import { create } from "zustand";
import { getAuthHeaders } from "../lib/supabase";

export type BrandingSettings = {
  appName: string;
  companyName: string;
  appDescription: string;
  address: string;
  hotline: string;
  taxCode: string;
  logoUrl: string;
  faviconUrl: string;
};

export const defaultBranding: BrandingSettings = {
  appName: "PMQL",
  companyName: "PMQL",
  appDescription: "Phần mềm quản lý bán hàng",
  address: "",
  hotline: "",
  taxCode: "",
  logoUrl: "",
  faviconUrl: ""
};

type BrandingStore = {
  branding: BrandingSettings;
  isLoadingBranding: boolean;
  brandingError?: string;
  loadBranding: () => Promise<void>;
  saveBranding: (branding: BrandingSettings) => Promise<void>;
};

function cleanBranding(input: Partial<BrandingSettings>): BrandingSettings {
  return {
    ...defaultBranding,
    ...Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value : ""])
    )
  };
}

function applyDocumentBranding(branding: BrandingSettings) {
  document.title = branding.appName || defaultBranding.appName;
  const favicon = branding.faviconUrl || branding.logoUrl;
  if (!favicon) return;

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = favicon;
}

export const useBrandingStore = create<BrandingStore>((set, get) => ({
  branding: defaultBranding,
  isLoadingBranding: false,
  loadBranding: async () => {
    if (get().isLoadingBranding) return;
    set({ isLoadingBranding: true, brandingError: undefined });
    try {
      const response = await fetch("/api/settings?key=branding");
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được nhận diện app");
      const branding = cleanBranding(body.branding ?? {});
      applyDocumentBranding(branding);
      set({ branding, isLoadingBranding: false });
    } catch (error) {
      applyDocumentBranding(defaultBranding);
      set({
        branding: defaultBranding,
        isLoadingBranding: false,
        brandingError: error instanceof Error ? error.message : "Không tải được nhận diện app"
      });
    }
  },
  saveBranding: async (branding) => {
    const payload = cleanBranding(branding);
    const response = await fetch("/api/settings?key=branding", {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được nhận diện app");
    const saved = cleanBranding(body.branding ?? payload);
    applyDocumentBranding(saved);
    set({ branding: saved, brandingError: undefined });
  }
}));
