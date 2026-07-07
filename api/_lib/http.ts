export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
};

export type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export function methodNotAllowed(res: ApiResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED", allowed });
}

export function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function requireInternalSecret(req: ApiRequest) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return;

  const header = req.headers?.["x-internal-secret"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (provided !== expected) {
    const error = new Error("Unauthorized internal operation.");
    error.name = "UNAUTHORIZED";
    throw error;
  }
}

export function sendError(res: ApiResponse, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const code = error instanceof Error && error.name === "UNAUTHORIZED" ? 401 : 500;
  res.status(code).json({ ok: false, error: message });
}
