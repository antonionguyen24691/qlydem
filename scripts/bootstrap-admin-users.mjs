import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  dotenv.config({ path: ".env.local", quiet: true });
}

const admins = [
  {
    email: "antonionguyen246@gmail.com",
    fullName: "Antonio Nguyen",
    passwordEnv: "PMQL_ADMIN_ANTON_PASSWORD"
  },
  {
    email: "lanphuongngothi237@gmail.com",
    fullName: "Lan Phuong Ngo Thi",
    passwordEnv: "PMQL_ADMIN_LANPHUONG_PASSWORD"
  }
];

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey || serviceRoleKey === "your-service-role-key") {
  throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY thật.");
}

for (const admin of admins) {
  if (!process.env[admin.passwordEnv]) {
    throw new Error(`Thiếu ${admin.passwordEnv}. Không hardcode mật khẩu vào git.`);
  }
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function findAuthUser(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return undefined;
  }
  return undefined;
}

async function ensureRoles() {
  const roles = [
    { role: "ADMIN", name: "Quản trị viên", permissions_json: { all: true } },
    {
      role: "ACCOUNTANT",
      name: "Kế toán",
      permissions_json: {
        orders: ["read"],
        customers: ["read"],
        finance: ["read", "create", "update"],
        reports: ["read"],
        export: ["read"]
      }
    },
    {
      role: "SALE",
      name: "Nhân viên bán hàng",
      permissions_json: {
        orders: ["read", "create"],
        customers: ["read", "create"],
        products: ["read"],
        finance: ["read_own"]
      }
    },
    {
      role: "WAREHOUSE",
      name: "Kho",
      permissions_json: {
        products: ["read"],
        inventory: ["read", "create", "update"],
        purchase: ["read", "create"]
      }
    },
    { role: "VIEWER", name: "Chỉ xem", permissions_json: { dashboard: ["read"], reports: ["read"] } }
  ];

  const { error } = await supabase.from("roles").upsert(roles, { onConflict: "role" });
  if (error) throw new Error(`roles: ${error.message}`);
}

async function ensureAdmin(admin) {
  const email = admin.email.toLowerCase();
  const password = process.env[admin.passwordEnv];
  const metadata = { full_name: admin.fullName, role: "ADMIN" };
  const existing = await findAuthUser(email);

  let authStatus = "created";
  let authUserId;
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "ADMIN" }
    });
    if (error) throw new Error(`updateUser ${email}: ${error.message}`);
    authStatus = "updated";
    authUserId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "ADMIN" }
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    authUserId = data.user?.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .upsert(
      {
        email,
        full_name: admin.fullName,
        role: "ADMIN",
        status: "ACTIVE",
        updated_at: new Date().toISOString()
      },
      { onConflict: "email" }
    )
    .select("id,email,full_name,role,status")
    .single();

  if (profileError) throw new Error(`users ${email}: ${profileError.message}`);
  return { email, authStatus, authUserId, profile };
}

await ensureRoles();
const result = [];
for (const admin of admins) {
  result.push(await ensureAdmin(admin));
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
