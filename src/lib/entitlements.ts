export type PlanCode = "BASIC" | "SMART" | "LOCAL" | "CLOUD" | "MOBILE";

export type PlanFeature =
  | "core"
  | "assistant"
  | "document_scan"
  | "local_runtime"
  | "cloud_database"
  | "mobile_apps";

const PLAN_FEATURES: Record<PlanCode, readonly PlanFeature[]> = {
  BASIC: ["core"],
  SMART: ["core", "assistant", "document_scan"],
  LOCAL: ["core", "assistant", "document_scan", "local_runtime"],
  CLOUD: ["core", "assistant", "document_scan", "cloud_database"],
  MOBILE: ["core", "assistant", "document_scan", "cloud_database", "mobile_apps"]
};

const PLAN_FEATURE_SET = new Set<PlanFeature>([
  "core",
  "assistant",
  "document_scan",
  "local_runtime",
  "cloud_database",
  "mobile_apps"
]);

export function getPlanFeatures(plan: string): readonly PlanFeature[] {
  return PLAN_FEATURES[plan as PlanCode] ?? [];
}

export function hasPlanFeature(plan: string, feature: PlanFeature) {
  return getPlanFeatures(plan).includes(feature);
}

export function resolvePlanFeatures(
  plan: string,
  overrides: Array<{ feature: string; enabled: boolean }>
) {
  const defaults = getPlanFeatures(plan);
  if (defaults.length === 0) return [];

  const features = new Set(defaults);
  for (const override of overrides) {
    if (!PLAN_FEATURE_SET.has(override.feature as PlanFeature)) continue;
    const feature = override.feature as PlanFeature;
    if (override.enabled) features.add(feature);
    else features.delete(feature);
  }
  return [...features].sort();
}
