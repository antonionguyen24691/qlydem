import type { ApiRequest } from "./http.js";

// In-memory sliding-window limiter. Trên serverless mỗi instance có bộ đếm riêng nên đây là
// lớp phòng thủ "best effort" (giảm spam/dò), không thay thế được rate-limit ở tầng hạ tầng.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function clientKey(req: ApiRequest, scope: string) {
  const forwarded = req.headers?.["x-forwarded-for"] ?? req.headers?.["X-Forwarded-For"];
  const ipRaw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (ipRaw ?? "unknown").split(",")[0]?.trim() || "unknown";
  const auth = req.headers?.authorization ?? req.headers?.Authorization;
  const token = Array.isArray(auth) ? auth[0] : auth;
  // Ưu tiên khóa theo token (đã đăng nhập) để nhiều máy sau NAT không dùng chung hạn mức.
  const identity = token ? `t:${token.slice(-24)}` : `ip:${ip}`;
  return `${scope}:${identity}`;
}

export class RateLimitError extends Error {
  constructor(message = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.") {
    super(message);
    this.name = "RATE_LIMITED";
  }
}

export function enforceRateLimit(req: ApiRequest, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = clientKey(req, scope);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > MAX_BUCKETS) {
      for (const [existingKey, existingBucket] of buckets) {
        if (existingBucket.resetAt <= now) buckets.delete(existingKey);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new RateLimitError();
  }
  bucket.count += 1;
}
