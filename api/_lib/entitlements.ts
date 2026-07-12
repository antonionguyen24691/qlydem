import { getSupabaseAdmin } from "./supabase.js";
import { resolvePlanFeatures, type PlanCode, type PlanFeature } from "../../src/lib/entitlements.js";

const PLAN_CODES = new Set<PlanCode>(["BASIC", "SMART", "LOCAL", "CLOUD", "MOBILE"]);

function requirePlanCode(value: unknown): PlanCode {
  if (typeof value === "string" && PLAN_CODES.has(value as PlanCode)) return value as PlanCode;
  throw new Error("License plan is invalid.");
}

export function assertEntitled(features: readonly string[], feature: PlanFeature) {
  if (features.includes(feature)) return;
  const error = new Error("FEATURE_NOT_ENTITLED");
  error.name = "FORBIDDEN";
  throw error;
}

export async function getEntitlementSnapshot(actorId: string) {
  const supabase = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", actorId)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (!profile.tenant_id) {
    const error = new Error("User tenant is not configured.");
    error.name = "FORBIDDEN";
    throw error;
  }

  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .select("id,plan_code,status,is_lifetime,activated_at,warranty_until,maintenance_until")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (licenseError) throw new Error(licenseError.message);
  if (!license) {
    return { tenantId: profile.tenant_id, license: null, features: [] };
  }

  const planCode = requirePlanCode(license.plan_code);
  const { data: rows, error: entitlementError } = await supabase
    .from("license_entitlements")
    .select("feature_key,enabled,limit_value,config")
    .eq("license_id", license.id);
  if (entitlementError) throw new Error(entitlementError.message);

  const overrides = (rows ?? []).map((row) => ({
    feature: row.feature_key,
    enabled: row.enabled
  }));
  const limits = Object.fromEntries(
    (rows ?? [])
      .filter((row) => row.enabled && row.limit_value !== null)
      .map((row) => [row.feature_key, row.limit_value])
  );

  return {
    tenantId: profile.tenant_id,
    license: {
      id: license.id,
      planCode,
      status: license.status,
      isLifetime: license.is_lifetime,
      activatedAt: license.activated_at,
      warrantyUntil: license.warranty_until,
      maintenanceUntil: license.maintenance_until
    },
    features: resolvePlanFeatures(planCode, overrides),
    limits
  };
}

export async function requireEntitlement(actorId: string, feature: PlanFeature) {
  const snapshot = await getEntitlementSnapshot(actorId);
  assertEntitled(snapshot.features, feature);
  return snapshot;
}
