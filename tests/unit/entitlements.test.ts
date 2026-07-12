import { describe, expect, it } from "vitest";
import { getPlanFeatures, hasPlanFeature, resolvePlanFeatures } from "../../src/lib/entitlements";

describe("plan entitlements", () => {
  it("keeps the basic plan limited to core operations", () => {
    expect(getPlanFeatures("BASIC")).toEqual(["core"]);
  });

  it("gives every advanced plan assistant access", () => {
    for (const plan of ["SMART", "LOCAL", "CLOUD", "MOBILE"] as const) {
      expect(hasPlanFeature(plan, "assistant")).toBe(true);
    }
  });

  it("does not leak deployment-specific features across plans", () => {
    expect(hasPlanFeature("LOCAL", "local_runtime")).toBe(true);
    expect(hasPlanFeature("LOCAL", "cloud_database")).toBe(false);
    expect(hasPlanFeature("CLOUD", "mobile_apps")).toBe(false);
    expect(hasPlanFeature("MOBILE", "mobile_apps")).toBe(true);
  });

  it("fails closed for unknown plan codes", () => {
    expect(getPlanFeatures("UNKNOWN")).toEqual([]);
  });

  it("applies stored overrides without allowing unknown features", () => {
    expect(resolvePlanFeatures("CLOUD", [
      { feature: "document_scan", enabled: false },
      { feature: "mobile_apps", enabled: true },
      { feature: "internal_only", enabled: true }
    ])).toEqual(["assistant", "cloud_database", "core", "mobile_apps"]);
  });

  it("does not allow overrides to activate an unknown plan", () => {
    expect(resolvePlanFeatures("UNKNOWN", [{ feature: "core", enabled: true }])).toEqual([]);
  });
});
