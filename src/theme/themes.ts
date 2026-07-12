export type ThemeId = "classic" | "moss" | "terracotta";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  description: string;
  /** Bố cục điều hướng desktop */
  layout: "sidebar" | "topnav";
  /** Kiểu sidebar khi layout = sidebar */
  sidebarVariant: "light" | "dark";
  /** Link CSS font cần nạp thêm (Google Fonts) */
  fontLinks: string[];
  /** Màu cho thẻ preview trong Cấu hình */
  preview: { bg: string; surface: string; primary: string; accent: string; ink: string };
};

export const themes: ThemeDef[] = [
  {
    id: "classic",
    name: "Classic (hiện tại)",
    description: "Emerald · sidebar trắng · Geist Sans",
    layout: "sidebar",
    sidebarVariant: "light",
    fontLinks: [],
    preview: { bg: "#fafafa", surface: "#ffffff", primary: "#059669", accent: "#006B68", ink: "#18181b" }
  },
  {
    id: "moss",
    name: "Xanh rêu thanh lịch",
    description: "Sidebar tối phân nhóm · nhấn vàng đồng",
    layout: "sidebar",
    sidebarVariant: "dark",
    fontLinks: [],
    preview: { bg: "#F4F4F0", surface: "#ffffff", primary: "#1B5E56", accent: "#E9B44C", ink: "#122E29" }
  },
  {
    id: "terracotta",
    name: "Đất nung hiện đại",
    description: "Menu ngang · cam đất nung · Space Grotesk",
    layout: "topnav",
    sidebarVariant: "light",
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
    ],
    preview: { bg: "#FBF7F2", surface: "#ffffff", primary: "#AE4F26", accent: "#2B2420", ink: "#2B2420" }
  }
];

export const defaultThemeId: ThemeId = "classic";

export const themesById: Record<string, ThemeDef> = Object.fromEntries(
  themes.map((theme) => [theme.id, theme])
) as Record<string, ThemeDef>;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in themesById;
}
