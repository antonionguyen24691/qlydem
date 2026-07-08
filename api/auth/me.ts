import type { ApiRequest, ApiResponse } from "../_lib/http";
import { methodNotAllowed, sendError } from "../_lib/http";
import { requireAuth } from "../_lib/auth";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const user = await requireAuth(req);
    res.status(200).json({ ok: true, user });
  } catch (error) {
    sendError(res, error);
  }
}
