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
  [pos, 'themeId === "moss" || themeId === "terracotta"', "classic theme isolation"],
  [layout, 'location.pathname === "/pos"', "POS route shell"],
  [css, '@scope (:root[data-theme="moss"], :root[data-theme="terracotta"])', "theme-scoped mobile layer"],
  [css, "grid-template-columns: repeat(2, minmax(0,1fr))", "two-column product catalog"],
  [css, "min-height: 44px", "minimum touch target"],
  [css, "env(safe-area-inset-bottom)", "safe-area checkout spacing"]
];

for (const [file, page] of pages) {
  required.push([read(`src/pages/${file}`), `data-mobile-page="${page}"`, `${page} mobile page marker`]);
}

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
if (missing.length) {
  console.error(`Mobile mockup verification failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mobile mockup implementation contract: OK");
