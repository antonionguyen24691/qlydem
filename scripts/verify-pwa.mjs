import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fromRoot = (file) => resolve(root, file);

function requireFile(file) {
  if (!existsSync(fromRoot(file))) throw new Error(`PWA verification failed: missing ${file}`);
}

function readPngSize(file) {
  const buffer = readFileSync(fromRoot(file));
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error(`PWA verification failed: ${file} is not a PNG file`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const requiredFiles = [
  "dist/manifest.webmanifest",
  "dist/sw.js",
  "dist/index.html",
  "public/favicon.svg",
  "public/favicon.ico"
];
for (const file of requiredFiles) requireFile(file);

// Đăng ký service worker qua virtual:pwa-register/react (UpdatePrompt) thay vì
// script auto-inject của vite-plugin-pwa (injectRegister: false trong
// vite.config.ts) — registerType "prompt" bắt buộc phải có UI gọi
// updateServiceWorker(), nếu không người dùng sẽ kẹt vĩnh viễn ở bản cache cũ
// sau mỗi lần deploy.
const appEntry = readFileSync(fromRoot("src/App.tsx"), "utf8");
const updatePrompt = readFileSync(fromRoot("src/features/pwa/UpdatePrompt.tsx"), "utf8");
if (!appEntry.includes("<UpdatePrompt")) {
  throw new Error("PWA verification failed: App.tsx does not mount <UpdatePrompt />");
}
if (!updatePrompt.includes("virtual:pwa-register/react") || !updatePrompt.includes("updateServiceWorker")) {
  throw new Error("PWA verification failed: UpdatePrompt does not register/apply service worker updates");
}

const icons = [
  ["public/pwa-64x64.png", 64],
  ["public/pwa-192x192.png", 192],
  ["public/pwa-512x512.png", 512],
  ["public/maskable-icon-512x512.png", 512],
  ["public/apple-touch-icon-180x180.png", 180]
];
for (const [file, size] of icons) {
  requireFile(file);
  const dimensions = readPngSize(file);
  if (dimensions.width !== size || dimensions.height !== size) {
    throw new Error(`PWA verification failed: ${file} must be ${size}x${size}`);
  }
}

const manifest = JSON.parse(readFileSync(fromRoot("dist/manifest.webmanifest"), "utf8"));
if (manifest.name !== "PMQL - Quản lý bán hàng" || manifest.short_name !== "PMQL") {
  throw new Error("PWA verification failed: manifest identity is incorrect");
}
if (manifest.display !== "standalone" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("PWA verification failed: standalone scope/start URL is incorrect");
}
if (!manifest.icons?.some((icon) => icon.sizes === "192x192")) {
  throw new Error("PWA verification failed: missing 192x192 icon");
}
if (!manifest.icons?.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")) {
  throw new Error("PWA verification failed: missing maskable icon");
}

const html = readFileSync(fromRoot("dist/index.html"), "utf8");
for (const expected of [
  'rel="manifest"',
  'rel="apple-touch-icon"',
  'name="apple-mobile-web-app-capable" content="yes"',
  'name="theme-color" content="#006B68"'
]) {
  if (!html.includes(expected)) throw new Error(`PWA verification failed: missing HTML metadata ${expected}`);
}

const serviceWorker = readFileSync(fromRoot("dist/sw.js"), "utf8");
if (!serviceWorker.includes("NavigationRoute") || !serviceWorker.includes("denylist") || !serviceWorker.includes("api")) {
  throw new Error("PWA verification failed: API navigation exclusion is missing");
}

console.log("PWA installability contract: OK");
