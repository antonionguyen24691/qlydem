# Patch: tích hợp theme vào app (index.css · Settings.tsx · Login.tsx)

Các sửa đổi exact-string vào 3 file hiện có của `CRM QLBH`. Áp sau khi đã copy
các file `src/**` trong gói này.

## 1. `src/index.css` — nạp token theme

Tìm:
```css
@theme {
  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}
```
Thêm ngay SAU khối trên:
```css
@import "./theme.css";
```
(Tailwind v4 cho phép `@import` sau `@theme`; nếu build cảnh báo thứ tự import,
chuyển dòng này lên ngay dưới `@import "tailwindcss" source(none);`.)

## 2. `src/pages/Settings.tsx` — thêm mục "Giao diện"

### 2a. Import component (sau dòng import cuối)
Tìm:
```ts
import { permissionCatalog, permissionScopeFor, permissionScopeLabels, permissionScopes, type PermissionScope, withPermissionScope } from "../lib/permissionCatalog";
```
Thêm ngay sau:
```ts
import { ThemeSettingsSection } from "../components/settings/ThemeSettingsSection";
```

### 2b. Mở rộng union type
Tìm (dòng 187):
```ts
  const [activeSection, setActiveSection] = useState<"general" | "payment" | "units" | "users" | "data" | "operations">("general");
```
Thay bằng:
```ts
  const [activeSection, setActiveSection] = useState<"general" | "payment" | "units" | "users" | "data" | "operations" | "appearance">("general");
```

### 2c. Nhận `?section=appearance` từ URL
Tìm:
```ts
    if (section && ["general", "payment", "units", "users", "data", "operations"].includes(section)) {
```
Thay bằng:
```ts
    if (section && ["general", "payment", "units", "users", "data", "operations", "appearance"].includes(section)) {
```
(và dòng cast ngay dưới: thêm `| "appearance"` vào cùng union.)

### 2d. Thêm tab
Tìm:
```ts
            ["operations", "Vận hành"]
```
Thay bằng:
```ts
            ["operations", "Vận hành"],
            ["appearance", "Giao diện"]
```

### 2e. Render section (đặt cạnh các section khác, ví dụ ngay trước
`{activeSection === "operations" && ...}`):
```tsx
        {activeSection === "appearance" && <ThemeSettingsSection />}
```

## 3. `src/pages/Login.tsx` — màn đăng nhập đúng theme

### 3a. Import store
Tìm:
```ts
import { useBrandingStore } from "../store/branding";
```
Thêm ngay sau:
```ts
import { useThemeStore } from "../store/theme";
```

### 3b. Gọi loadTheme trong useEffect sẵn có
Tìm:
```ts
  useEffect(() => {
    loadSession().then(() => {
      if (useAuthStore.getState().isAuthenticated) navigate("/", { replace: true });
    });
  }, [loadSession, navigate]);
```
Thay bằng:
```ts
  useEffect(() => {
    useThemeStore.getState().loadTheme();
    loadSession().then(() => {
      if (useAuthStore.getState().isAuthenticated) navigate("/", { replace: true });
    });
  }, [loadSession, navigate]);
```
(GET `/api/settings?key=appearance` không cần auth — xem patch API.)

## 4. Quét hex cứng còn sót (tùy chọn, nên làm)

```bash
grep -rl '#006B68' src | xargs sed -i '' 's/\[#006B68\]/emerald-600/g'
```
Kiểm tra diff — chỉ giữ các chỗ dùng làm ring/focus màu primary.
