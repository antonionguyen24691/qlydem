import type { ApiRequest, ApiResponse } from "../_lib/http";
import { methodNotAllowed, requireInternalSecret, sendError } from "../_lib/http";

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    requireInternalSecret(req);
    res.status(200).json({
      ok: true,
      user: {
        id: "bootstrap-admin",
        name: "Bootstrap Admin",
        role: "ADMIN"
      }
    });
  } catch (error) {
    sendError(res, error);
  }
}
