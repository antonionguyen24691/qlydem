import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const migration = read("supabase/migrations/20260712_update2_entitlements.sql");
const featureContract = read("src/lib/entitlements.ts");
const entitlementService = read("api/_lib/entitlements.ts");
const settingsApi = read("api/settings/index.ts");

const required = [
  [migration, "create table if not exists public.tenants", "tenant table"],
  [migration, "create table if not exists public.licenses", "license table"],
  [migration, "create table if not exists public.license_entitlements", "entitlement overrides"],
  [migration, "create table if not exists public.license_installations", "license installations"],
  [migration, "create table if not exists public.usage_counters", "usage counters"],
  [migration, "licenses_one_active_per_tenant_idx", "single active license guard"],
  [migration, "enable row level security", "RLS enablement"],
  [migration, "revoke all on table", "direct access revoke"],
  [featureContract, "resolvePlanFeatures", "fail-closed feature resolver"],
  [entitlementService, '.from("license_entitlements")', "database entitlement lookup"],
  [entitlementService, "assertEntitled", "backend entitlement guard"],
  [entitlementService, "FEATURE_NOT_ENTITLED", "stable entitlement error code"],
  [settingsApi, 'key === "entitlements"', "settings entitlement endpoint"],
  [settingsApi, "requireAuth(req)", "authenticated endpoint"]
];

const missing = required
  .filter(([source, expected]) => !source.includes(expected))
  .map(([, , label]) => label);

if (missing.length > 0) {
  throw new Error(`Update 2.0 foundation verification failed: missing ${missing.join(", ")}`);
}

if (/grant\s+.+\s+to\s+(anon|authenticated)/i.test(migration)) {
  throw new Error("Update 2.0 foundation verification failed: new license tables grant direct client access.");
}

console.log("Update 2.0 entitlement foundation: OK");
