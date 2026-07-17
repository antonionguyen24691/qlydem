# Patch: thêm key `appearance` vào `api/settings/index.ts`

Áp 4 sửa đổi exact-string sau vào file `api/settings/index.ts` hiện có
(không thay file nguyên vẹn để tránh đè các chỉnh sửa khác).

## 1. Thêm type + default + normalize (chèn sau khối `defaultInventoryOperations`)

```ts
type AppearanceSettings = {
  themeId: "classic" | "moss" | "terracotta";
};

const defaultAppearance: AppearanceSettings = { themeId: "classic" };

function normalizeAppearance(input: Record<string, unknown>): AppearanceSettings {
  const themeId = toStringValue(input.themeId, defaultAppearance.themeId).trim();
  return {
    themeId: ["classic", "moss", "terracotta"].includes(themeId)
      ? (themeId as AppearanceSettings["themeId"])
      : defaultAppearance.themeId
  };
}
```

## 2. `normalizeSetting` — thêm nhánh

Tìm:
```ts
  if (key === "expenseCategories") return normalizeExpenseCategories(input);
```
Thêm ngay sau:
```ts
  if (key === "appearance") return normalizeAppearance(input);
```

## 3. Whitelist key

Tìm:
```ts
    if (!["branding", "payment", "units", "inventoryOperations", "expenseCategories"].includes(key)) {
```
Thay bằng:
```ts
    if (!["branding", "payment", "units", "inventoryOperations", "expenseCategories", "appearance"].includes(key)) {
```

## 4. GET không cần auth (để trang đăng nhập cũng theo theme)

Tìm:
```ts
      if (key !== "branding") await requireAuth(req);
```
Thay bằng:
```ts
      if (key !== "branding" && key !== "appearance") await requireAuth(req);
```

## 5. Trả `appearance` trong response GET và POST

Trong **cả 3** khối `res.status(200).json({ ... })` (GET thành công, GET fallback,
POST), thêm dòng sau cạnh `expenseCategories: ...`:

```ts
          appearance: key === "appearance" ? normalizeAppearance(value) : undefined,
```

(Ở khối GET fallback dùng `defaultAppearance` thay vì `normalizeAppearance(value)`:)

```ts
          appearance: key === "appearance" ? defaultAppearance : undefined,
```

## Ghi chú

- POST vẫn đi qua `requirePermission(req, "settings.manage")` → chỉ ADMIN lưu được theme. Không cần đổi gì thêm.
- Giá trị lưu trong bảng `settings` với `key = 'appearance'`, `value = {"themeId": "moss"}` — không cần migration.
- Audit log hoạt động sẵn (cùng luồng upsert hiện có).
