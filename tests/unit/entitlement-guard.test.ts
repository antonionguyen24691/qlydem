import { describe, expect, it } from "vitest";
import { assertEntitled } from "../../api/_lib/entitlements";

describe("entitlement guard", () => {
  it("allows a feature present in the effective license", () => {
    expect(() => assertEntitled(["core", "assistant"], "assistant")).not.toThrow();
  });

  it("returns a forbidden error when the feature is missing", () => {
    expect(() => assertEntitled(["core"], "document_scan")).toThrowError(
      expect.objectContaining({ name: "FORBIDDEN", message: "FEATURE_NOT_ENTITLED" })
    );
  });
});
