# PMQL — Hệ thống Theme (2 giao diện mới + classic, admin chọn trong Cấu hình)

Gói handoff để tích hợp vào codebase `CRM QLBH` (React 18 + Vite + Tailwind v4 + zustand + Vercel API + Supabase).

## Thiết kế tham chiếu (mở trong project thiết kế)

- `PMQL-A.dc.html` — theme **moss** (1a Xanh rêu thanh lịch): sidebar tối `#122E29` phân nhóm, primary `#1B5E56`, accent vàng đồng `#E9B44C`, nền `#F4F4F0`.
- `PMQL-B.dc.html` — theme **terracotta** (1b Đất nung hiện đại): menu ngang không sidebar, primary `#AE4F26`, nền giấy kraft `#FBF7F2`, heading Space Grotesk.
- `PMQL-hien-tai.dc.html` — classic (đối chiếu).
- `PMQL-mobile.dc.html` — mockup mobile 8 màn hình (Tổng quan · POS · Tài chính · Đơn hàng cho Moss; Tổng quan · POS · Tài chính · Menu drawer cho Terracotta) kèm bottom tab bar — đối chiếu khi làm mobile.
- `PMQL-theme-picker.dc.html` — mockup mục "Cấu hình → Giao diện (theme)" — đối chiếu với `ThemeSettingsSection.tsx`.

## Nguyên lý (vì sao KHÔNG phải sửa từng trang)

Tailwind v4 biên dịch mọi utility màu thành `var(--color-…)`. `theme.css` ghi đè
các biến `--color-emerald-*`, `--color-zinc-*`, `--color-gray-*`… theo selector
`:root[data-theme="…"]`. Đổi `data-theme` trên `<html>` ⇒ **toàn bộ app** (POS,
Finance, Orders, dialogs…) đổi màu ngay, mọi tính năng và responsive hiện có giữ
nguyên 100%. Phần "bố cục" (sidebar tối / menu ngang / bottom tab mobile) do 4
file layout đảm nhiệm.

## Files trong gói

| File | Vai trò | Cách dùng |
|---|---|---|
| `src/theme.css` | Token 2 theme mới | Copy vào `src/`, thêm `@import "./theme.css";` cuối `src/index.css` |
| `src/theme/themes.ts` | Metadata theme (layout, font, preview) | Copy mới |
| `src/store/theme.ts` | Zustand store: load/save/preview + localStorage fallback | Copy mới |
| `src/components/layout/MainLayout.tsx` | Chuyển layout theo theme + BottomTabBar | **Thay thế** file cùng đường dẫn |
| `src/components/layout/Sidebar.tsx` | Sidebar 2 biến thể light/dark + prop `mobileOnly` | **Thay thế** |
| `src/components/layout/TopNav.tsx` | Nav ngang cho terracotta (đủ notifications/search/logout) | Copy mới |
| `src/components/layout/BottomTabBar.tsx` | Tab bar đáy cho mobile, mọi theme | Copy mới |
| `src/components/settings/ThemeSettingsSection.tsx` | Mục chọn theme trong Cấu hình (admin) | Copy mới |
| `patches/api-settings-appearance.md` | Patch thêm key `appearance` vào API settings | Áp theo hướng dẫn |
| `patches/app-integration.md` | Patch exact-string cho `index.css` · `Settings.tsx` · `Login.tsx` (bước 2–6 dưới dạng diff cụ thể) | Áp theo hướng dẫn |

## Các bước tích hợp

1. Copy các file `src/**` vào đúng đường dẫn tương ứng (2 file thay thế, còn lại là file mới).
2. `src/index.css`: thêm dòng `@import "./theme.css";` (sau khối `@theme`).
3. Áp patch API theo `patches/api-settings-appearance.md`.
4. `src/pages/Settings.tsx`: thêm tab "Giao diện" render `<ThemeSettingsSection />` — diff cụ thể trong `patches/app-integration.md`. Trang Settings đã là admin-only nên không cần guard thêm.
5. (Tùy chọn, nên làm) Trang Login: gọi `useThemeStore.getState().loadTheme()` trong `useEffect` để màn đăng nhập cũng đúng theme (GET `appearance` không cần auth).
6. Quét hex cứng còn sót: thay `ring-[#006B68]` / `focus:ring-[#006B68]` bằng `ring-emerald-600` để focus ring đổi theo theme:
   ```bash
   grep -rl '#006B68' src | xargs sed -i '' 's/\[#006B68\]/emerald-600/g'
   ```
   (kiểm tra lại diff — chỉ đổi các chỗ dùng làm ring/focus màu primary).

## Hành vi

- **Admin** vào Cấu hình → "Giao diện (theme)": bấm thẻ = preview ngay toàn app; **Lưu** = POST `/api/settings?key=appearance` (quyền `settings.manage`), áp cho mọi người dùng; **Hủy xem trước** = quay về theme đã lưu.
- Người dùng thường: theme tải qua GET khi vào app; localStorage `pmql-theme` giúp paint đúng màu ngay khi mở (không nháy).
- **Mobile (<1024px)**: mọi theme có BottomTabBar (Tổng quan / Bán hàng / Đơn hàng / Tài chính / Menu — lọc theo quyền, hit target 56px, chừa `safe-area-inset-bottom`); nút Menu mở Sidebar drawer sẵn có. Nội dung chính đã chừa `pb-16 lg:pb-0`.
- **Terracotta trên desktop**: TopNav ngang thay Sidebar+Topbar; trên mobile TopNav rút gọn (logo + chuông + user) và điều hướng nằm ở BottomTabBar + drawer.

## Token chính (đối chiếu nhanh)

- **moss**: bg `#F4F4F0` · surface `#fff` · sidebar `#122E29` · primary `#1B5E56` (hover `#12463F`) · accent `#E9B44C` · danger `#C2452D` · border `#E2E2DA` · text `#1C1C1A`/`#6B6B62`. Font: Geist (sẵn có).
- **terracotta**: bg `#FBF7F2` · surface `#fff` · primary `#AE4F26` (hover `#8C3C1B`) · ink `#2B2420` · border `#EBE2D8` · muted `#7A6A5D`. Font: Instrument Sans (body) + Space Grotesk (h1/h2) — store tự inject Google Fonts link.
- Mapping: primary ↔ thang `emerald-*`, neutral ↔ `zinc-*` và `gray-*` (Topbar dùng gray). Red được tinh chỉnh trầm hơn cho hợp tông; các màu khác (amber, sky…) giữ mặc định.

## Kiểm thử gợi ý

1. Đăng nhập ADMIN → Cấu hình → đổi 3 theme, kiểm tra POS/Finance/Orders/dialog đổi màu đồng bộ, không vỡ layout.
2. Đăng nhập SALE → không thấy mục theme; theme do admin lưu vẫn áp dụng.
3. Thu nhỏ cửa sổ <1024px: BottomTabBar hiện, tab lọc theo quyền, Menu mở drawer; POS vẫn thao tác được.
4. Tắt mạng → mở app: theme từ localStorage áp ngay, không nháy trắng.
5. In bill từ POS: bill dùng style riêng (`printBill.ts`) — không bị ảnh hưởng bởi theme (kiểm tra xác nhận).
