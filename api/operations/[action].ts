import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed } from "../_lib/http.js";
import clearHistory from "../_lib/operationsClearHistory.js";
import notifications from "../_lib/operationsNotifications.js";
import readiness from "../_lib/operationsReadiness.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = getQueryValue(req.query?.action);

  if (action === "clear-history") return clearHistory(req, res);
  if (action === "notifications") return notifications(req, res);
  if (action === "readiness") return readiness(req, res);

  res.status(400).json({ ok: false, error: "Unsupported operations action." });
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}
