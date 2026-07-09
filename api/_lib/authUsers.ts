import type { SupabaseClient } from "@supabase/supabase-js";

type AuthUserListItem = {
  id: string;
  email?: string;
};

export async function findAuthUserIdByEmail(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const users = data.users as AuthUserListItem[];
    const found = users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (found) return found.id;
    if (users.length < 100) return undefined;
  }
  return undefined;
}

export async function upsertAuthPassword(supabase: SupabaseClient, email: string, password?: string) {
  if (!password) return;
  if (password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");

  const normalizedEmail = email.trim().toLowerCase();
  const authUserId = await findAuthUserIdByEmail(supabase, normalizedEmail);
  if (authUserId) {
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true
  });
  if (error) throw new Error(error.message);
}
