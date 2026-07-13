import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const pos = read("src/pages/POS.tsx");
const layout = read("src/components/layout/MainLayout.tsx");
const css = read("src/mobile-mockup.css");

const pages = [
  ["Dashboard.tsx", "dashboard"], ["Orders.tsx", "orders"], ["Finance.tsx", "finance"],
  ["Products.tsx", "products"], ["Inventory.tsx", "inventory"], ["Customers.tsx", "customers"],
  ["Suppliers.tsx", "suppliers"], ["Settings.tsx", "settings"], ["Expenses.tsx", "expenses"],
  ["Bill.tsx", "bill"], ["Login.tsx", "login"]
];

const required = [
  [pos, 'data-mobile-page="pos"', "POS mobile page marker"],
  [pos, "pos-mobile-product-grid", "catalog-first product grid"],
  [pos, "pos-mobile-checkout-dock", "mobile checkout dock"],
  [pos, 'aria-label="Mở menu điều hướng"', "POS navigation escape"],
  [pos, "data-mobile-theme={themeId}", "runtime mobile theme marker"],
  [pos, "pos-mobile-moss", "Moss POS presentation"],
  [pos, "pos-mobile-terracotta", "Terracotta POS presentation"],
  [pos, 'isTerracotta ? "Thanh toán & in bill" : "Hoàn tất — In hóa đơn"', "theme-specific checkout copy"],
  [pos, "isMoss &&", "Moss-only catalog scanner"],
  [pos, 'themeId === "moss" || themeId === "terracotta"', "classic theme isolation"],
  [layout, 'location.pathname === "/pos"', "POS route shell"],
  [css, '@scope (:root[data-theme="moss"], :root[data-theme="terracotta"])', "theme-scoped mobile layer"],
  [css, "grid-template-columns: repeat(2, minmax(0,1fr))", "two-column product catalog"],
  [css, "min-height: 44px", "minimum touch target"],
  [css, "env(safe-area-inset-bottom)", "safe-area checkout spacing"],
  [css, "MOSS ART DIRECTION", "Moss independent art direction"],
  [css, "TERRACOTTA ART DIRECTION", "Terracotta independent art direction"],
  [css, ':root[data-theme="terracotta"] .pos-mobile-checkout-dock', "Terracotta white checkout dock"]
];

for (const [file, page] of pages) {
  const source = read(`src/pages/${file}`);
  required.push([source, `data-mobile-page="${page}"`, `${page} mobile page marker`]);
  required.push([source, "data-mobile-theme={themeId}", `${page} runtime theme marker`]);
}

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
if (missing.length) {
  console.error(`Mobile mockup verification failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mobile mockup implementation contract: OK");
