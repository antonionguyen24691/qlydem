const REQUIRED_SERVER_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export function assertServerEnv(extra: string[] = []) {
  const missing = [...REQUIRED_SERVER_ENV, ...extra].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
}

export function getGooglePrivateKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return raw?.replace(/\\n/g, "\n");
}
