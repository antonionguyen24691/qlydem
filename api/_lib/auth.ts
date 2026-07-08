import type { ApiRequest } from "./http";
import { getSupabaseAdmin } from "./supabase";

export type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
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
  let activeProfile = profile;
  if (!activeProfile) {
    const { count, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);

    if (count === 0) {
      const { data: created, error: createError } = await supabase
        .from("users")
        .insert({
          email,
          full_name: authData.user.user_metadata?.full_name ?? authData.user.user_metadata?.name ?? email,
          role: "ADMIN",
          status: "ACTIVE"
        })
        .select("id,email,full_name,role,status")
        .single();
      if (createError) throw new Error(createError.message);
      activeProfile = created;
    }
  }

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

  return {
    id: activeProfile.id,
    email: activeProfile.email,
    fullName: activeProfile.full_name,
    role: activeProfile.role,
    status: activeProfile.status
  } as ApiUser;
}
