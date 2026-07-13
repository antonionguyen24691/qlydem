# Moss/Terracotta Mobile Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho mobile/PWA Moss và Terracotta bám đúng hai bộ mockup riêng mà không nhân đôi nghiệp vụ hoặc làm thay đổi Classic/desktop.

**Architecture:** Store, selectors, API calls và event handlers tiếp tục nằm trong các page hiện có. Presentation khác biệt được biểu diễn bằng theme marker rõ ràng trên DOM và các CSS section độc lập; POS có các nhánh JSX nhỏ tại đúng chỗ composition khác nhau, không sao chép toàn màn hình.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS v4, CSS `@scope`, Vitest contract tests, Vite PWA.

## Global Constraints

- Nguồn chuẩn là `PMQL-A*.dc.html`, `PMQL-B*.dc.html`, `PMQL-mobile*.dc.html` trong `theme new/Nâng cấp giao diện ứng dụng`.
- Classic không thay đổi.
- Không thay đổi API, schema, quyền, logic tiền, công nợ hoặc tồn kho.
- Touch target chính tối thiểu 44px; safe-area trên/dưới phải được giữ.
- Dialog chỉ tách composition nếu mockup yêu cầu; dialog được handoff cho dùng chung chỉ đổi token/style.
- Không stage `.claude/settings.local.json`, `.codex-remote-attachments/` hoặc `theme new/`.

---

### Task 1: Theme-specific mobile contract

**Files:**
- Modify: `scripts/verify-mobile-mockup.mjs`
- Modify: `src/pages/POS.tsx`
- Modify: `src/mobile-mockup.css`

**Interfaces:**
- Consumes: `themeId: "classic" | "moss" | "terracotta"` từ `useThemeStore`.
- Produces: DOM marker `data-mobile-theme`, `.pos-mobile-moss`, `.pos-mobile-terracotta`, CSS sections `MOSS ART DIRECTION` và `TERRACOTTA ART DIRECTION`.

- [ ] **Step 1: Thêm contract thất bại cho hai presentation**

```js
[pos, 'data-mobile-theme={themeId}', "runtime mobile theme marker"],
[pos, 'pos-mobile-moss', "Moss POS presentation"],
[pos, 'pos-mobile-terracotta', "Terracotta POS presentation"],
[css, "MOSS ART DIRECTION", "Moss independent art direction"],
[css, "TERRACOTTA ART DIRECTION", "Terracotta independent art direction"]
```

- [ ] **Step 2: Chạy contract và xác nhận FAIL**

Run: `npm.cmd run verify:mobile-mockup`

Expected: FAIL, liệt kê các marker mới chưa tồn tại.

- [ ] **Step 3: Thêm marker tối thiểu vào POS và CSS**

```tsx
<div data-mobile-page="pos" data-mobile-theme={themeId} className={`mobile-mockup-page ${mobilePosClass} flex h-[calc(100vh-64px)] flex-col bg-zinc-50 relative pb-20 lg:pb-0`}>
```

```css
/* MOSS ART DIRECTION */
:root[data-theme="moss"] { --mobile-page-bg: #F4F4F0; --mobile-accent: #E9B44C; }
/* TERRACOTTA ART DIRECTION */
:root[data-theme="terracotta"] { --mobile-page-bg: #FBF7F2; --mobile-accent: #AE4F26; }
```

- [ ] **Step 4: Chạy contract và xác nhận PASS**

Run: `npm.cmd run verify:mobile-mockup`

Expected: `Mobile mockup implementation contract: OK`.

### Task 2: POS presentation parity

**Files:**
- Modify: `src/pages/POS.tsx`
- Modify: `src/mobile-mockup.css`
- Test: `scripts/verify-mobile-mockup.mjs`

**Interfaces:**
- Consumes: `isMoss`, `isTerracotta`, `mobileProducts`, `cart`, `getCartTotal()`, checkout handlers hiện có.
- Produces: Moss dark checkout composition và Terracotta paper/white checkout composition trên cùng nghiệp vụ.

- [ ] **Step 1: Bổ sung contract cho POS khác biệt**

```js
[pos, 'isTerracotta ? "Thanh toán & in bill" : "Hoàn tất — In hóa đơn"', "theme-specific checkout copy"],
[pos, 'usesMobileMockup && !isTerracotta', "Moss-only catalog scanner"],
[css, ':root[data-theme="terracotta"] .pos-mobile-checkout-dock', "Terracotta white checkout dock"]
```

- [ ] **Step 2: Tạo booleans presentation và marker class**

```tsx
const isMoss = themeId === "moss";
const isTerracotta = themeId === "terracotta";
const mobilePosClass = isTerracotta ? "pos-mobile-terracotta" : "pos-mobile-moss";
```

- [ ] **Step 3: Tách khác biệt JSX nhỏ, giữ chung handlers**

```tsx
{isMoss && (
  <button type="button" className="pos-mobile-scan" onClick={() => setShowProductPicker(true)} aria-label="Mở danh mục sản phẩm">
    <Package className="h-5 w-5" />
  </button>
)}
<span className="pos-mobile-product-code">{product.code}</span>
<span className="pos-mobile-product-stock">{product.stock.toLocaleString("vi-VN")} {product.unit}</span>
<button className="pos-mobile-complete">{isTerracotta ? "Thanh toán & in bill" : "Hoàn tất — In hóa đơn"}</button>
```

- [ ] **Step 4: Viết style Moss theo mockup**

Moss: catalog nền `#F4F4F0`, scan/dock `#122E29`, accent `#E9B44C`, card radius 12px, price xanh, bottom dock bo 20px, payment block 10px.

- [ ] **Step 5: Viết style Terracotta độc lập**

Terracotta: catalog `#FBF7F2`, code cam, stock nằm cùng vùng giá, card radius 14px, dock trắng có top border, total cam, payment pill, CTA cam `#AE4F26`.

- [ ] **Step 6: Chạy contract**

Run: `npm.cmd run verify:mobile-mockup`

Expected: PASS.

### Task 3: Dashboard, Finance and Orders parity

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Finance.tsx`
- Modify: `src/pages/Orders.tsx`
- Modify: `src/mobile-mockup.css`
- Test: `scripts/verify-mobile-mockup.mjs`

**Interfaces:**
- Consumes: các grid, table và action hiện có; `data-mobile-page` marker.
- Produces: `data-mobile-theme={themeId}` trên ba page và theme-scoped page composition.

- [ ] **Step 1: Thêm `useThemeStore`/marker vào page chưa có**

```tsx
const themeId = useThemeStore((state) => state.themeId);
<div data-mobile-page="dashboard" data-mobile-theme={themeId} className="mobile-mockup-page relative mx-auto w-full max-w-7xl p-3 pb-24 sm:p-6 lg:p-8">
```

- [ ] **Step 2: Viết Moss page grammar**

Dashboard KPI/card giữ enclosure, Finance debt bands dạng card, Orders rows dạng card có shadow nhẹ và radius 12–14px.

- [ ] **Step 3: Viết Terracotta editorial grammar**

Dashboard KPI chuyển thành dải hai cột có divider; Finance summary/danh sách phẳng với section rule; Orders dùng row trắng tối giản, divider và typography Space Grotesk cho số.

- [ ] **Step 4: Chạy contract**

Run: `npm.cmd run verify:mobile-mockup`

Expected: PASS với marker dashboard/finance/orders.

### Task 4: Catalog and relationship pages parity

**Files:**
- Modify: `src/pages/Products.tsx`
- Modify: `src/pages/Inventory.tsx`
- Modify: `src/pages/Customers.tsx`
- Modify: `src/pages/Suppliers.tsx`
- Modify: `src/mobile-mockup.css`
- Test: `scripts/verify-mobile-mockup.mjs`

**Interfaces:**
- Consumes: table markup và action buttons hiện có.
- Produces: Moss card rows và Terracotta flat rows, không thay đổi columns/data/actions.

- [ ] **Step 1: Gắn `data-mobile-theme={themeId}` vào bốn page và customer detail**

Mỗi page đọc `themeId` từ `useThemeStore`; customer list và detail dùng cùng giá trị.

- [ ] **Step 2: Style Moss**

Table header ẩn trên mobile; mỗi row là white card, border `--color-zinc-200`, radius 12px, gap 9px, action target 44px.

- [ ] **Step 3: Style Terracotta**

Table header ẩn; tbody không gap; row border-bottom, radius 0, shadow none, Space Grotesk cho price/debt/stock emphasis, filter/action buttons dạng pill.

- [ ] **Step 4: Chạy contract và typecheck**

Run lần lượt: `npm.cmd run verify:mobile-mockup`, rồi `npm.cmd run lint`.

Expected: contract OK, `tsc --noEmit` exit 0.

### Task 5: Supporting screens, chrome and shared dialogs

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Expenses.tsx`
- Modify: `src/pages/Bill.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomTabBar.tsx`
- Modify: `src/mobile-mockup.css`
- Test: `scripts/verify-mobile-mockup.mjs`

**Interfaces:**
- Consumes: theme store, existing navigation/permission filtering và dialog DOM.
- Produces: Moss dark drawer/tab bar, Terracotta white drawer/tab bar, theme-specific login/settings/supporting surfaces.

- [ ] **Step 1: Gắn theme marker vào supporting pages**

`Settings`, `Login`, `Expenses`, `Bill` đọc `themeId` và render `data-mobile-theme={themeId}`.

- [ ] **Step 2: Hoàn thiện chrome**

Moss: drawer/nav dark green, active inset vàng. Terracotta: drawer/nav white, divider kraft, active orange, logo/heading Space Grotesk. POS menu button mở cùng drawer và luôn đạt 44px.

- [ ] **Step 3: Hoàn thiện login/settings/supporting pages**

Moss dùng card/surface tối giản trên nền kem; Terracotta dùng paper layout, divider và giảm enclosure. Shared dialog nhận token/radius/button styles theo root theme, không tách logic.

- [ ] **Step 4: Chạy contract, tests và PWA verification**

Run: `npm.cmd run verify:mobile-mockup; npm.cmd test; npm.cmd run verify:pwa`

Expected: contract OK, 12 tests pass, PWA verification OK.

### Task 6: Regression, visual smoke and production release

**Files:**
- Modify: `scripts/verify-mobile-mockup.mjs`
- Modify: `mobile-mockup-implementation.md`

**Interfaces:**
- Consumes: toàn bộ implementation Task 1–5.
- Produces: verified commit trên release branch và `main`, Vercel production READY.

- [ ] **Step 1: Chạy full local verification**

Run:

```powershell
npm.cmd run verify:mobile-mockup
npm.cmd run lint
npm.cmd test
npm.cmd run verify:pwa
npm.cmd run build
git diff --check
```

Expected: tất cả exit 0; 12/12 tests pass; Vite production build hoàn tất.

- [ ] **Step 2: Runtime/visual smoke**

Khởi động app local và kiểm tra ở 390x844, 430x932 và desktop: đổi theme Moss/Terracotta, mở Dashboard/POS/Finance/Orders/Products/Customers/Login/Settings/drawer; thử search, add item, quantity, payment selector và navigation escape.

- [ ] **Step 3: Cập nhật implementation note**

Ghi lại architecture split, màn hình đã đối chiếu, commands đã chạy và giới hạn visual automation nếu có.

- [ ] **Step 4: Commit implementation**

Stage chỉ code/test/doc thuộc kế hoạch và commit message `Complete Moss and Terracotta mobile parity`.

- [ ] **Step 5: Push và deploy**

```powershell
git push origin HEAD:codex-main-mobile-release HEAD:main
npx.cmd vercel inspect qlydem.vercel.app --wait --timeout 6m
```

Expected: hai remote refs cùng SHA; Vercel target `production`, status `Ready`, alias `https://qlydem.vercel.app`.

- [ ] **Step 6: Xác minh live asset**

Request `/pos` và các route chính; xác nhận HTTP 200 và bundle/CSS live chứa `pos-mobile-moss`, `pos-mobile-terracotta`, `Mở menu điều hướng` cùng hai theme art-direction markers.
