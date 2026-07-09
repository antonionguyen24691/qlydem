import type { ApiRequest } from "./http.js";
import { getSupabaseAdmin } from "./supabase.js";
import { hasPermission, normalizePermissions, type PermissionMap } from "./permissions.js";

export type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  permissions: PermissionMap;
};

function getBearerToken(req: ApiRequest) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

export async function requireAuth(req: ApiRequest, allowedRoles?: string[]) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing bearer token.");
    error.name = "UNAUTHORIZED";
    throw error;
  }

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user?.email) {
    const error = new Error("Invalid Supabase session.");
    error.name = "UNAUTHORIZED";
    throw error;
  }

  const email = authData.user.email.toLowerCase();
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id,email,full_name,role,status")
    .eq("email", email)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const activeProfile = profile;

  if (!activeProfile) {
    const error = new Error("User is not provisioned in CRM users table.");
    error.name = "FORBIDDEN";
    throw error;
  }
  if (activeProfile.status !== "ACTIVE") {
    const error = new Error("User is inactive.");
    error.name = "FORBIDDEN";
    throw error;
  }
  if (allowedRoles?.length && !allowedRoles.includes(activeProfile.role)) {
    const error = new Error("User does not have permission for this action.");
    error.name = "FORBIDDEN";
    throw error;
  }

  const { data: roleDefinition, error: roleError } = await supabase
    .from("roles")
    .select("permissions_json")
    .eq("role", activeProfile.role)
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  const permissions = normalizePermissions(activeProfile.role, roleDefinition?.permissions_json);

  return {
    id: activeProfile.id,
    email: activeProfile.email,
    fullName: activeProfile.full_name,
    role: activeProfile.role,
    status: activeProfile.status,
    permissions
  } as ApiUser;
}

export async function requirePermission(req: ApiRequest, permission: string) {
  const actor = await requireAuth(req);
  if (!hasPermission(actor.permissions, permission)) {
    const error = new Error("User does not have permission for this action.");
    error.name = "FORBIDDEN";
    throw error;
  }
  return actor;
}
