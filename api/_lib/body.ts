import type { ApiRequest } from "./http";

export function getJsonBody<T extends Record<string, unknown>>(req: ApiRequest): T {
  if (!req.body || typeof req.body !== "object") return {} as T;
  return req.body as T;
}

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toStringValue(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function optionalString(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

export function createCode(prefix: string) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = String(now.getTime()).slice(-6);
  return `${prefix}${date}-${suffix}`;
}
