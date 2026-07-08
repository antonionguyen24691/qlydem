import { FormEvent, useEffect, useState } from "react";
import { Database, Download, Save, Upload, UserPlus, Users } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";

const importTargets = [
  {
    entity: "customers",
    title: "Khách hàng",
    description: "Upload danh sách khách hàng, hạn mức nợ, nợ đầu kỳ và thông tin liên hệ."
  },
  {
    entity: "suppliers",
    title: "Nhà cung cấp",
    description: "Upload nhà cung cấp, điều khoản thanh toán và công nợ phải trả đầu kỳ."
  },
  {
    entity: "products",
    title: "Hàng hóa",
    description: "Upload mã hàng, nguyên liệu, bán thành phẩm, thành phẩm, hàng hóa, giá và trạng thái."
  }
] as const;

type ImportResult = {
  ok: boolean;
  batchId?: string;
  totalRows?: number;
  successRows?: number;
  failedRows?: number;
  error?: string;
};

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  status: string;
  sale_code?: string;
};

type Role = {
  role: string;
  name: string;
  permissions_json: Record<string, unknown>;
};

const emptyForm = {
  id: "",
  email: "",
  fullName: "",
  phone: "",
  role: "SALE",
  status: "ACTIVE",
  saleCode: ""
};

export function Settings() {
  const [uploading, setUploading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userError, setUserError] = useState("");

  const loadAdminData = async () => {
    try {
      const headers = await getAuthHeaders();
      const [userResponse, roleResponse] = await Promise.all([
        fetch("/api/users", { headers }),
        fetch("/api/roles", { headers })
      ]);
      const userBody = await userResponse.json();
      const roleBody = await roleResponse.json();
      if (!userResponse.ok || !userBody.ok) throw new Error(userBody.error ?? "Không tải được users");
      if (!roleResponse.ok || !roleBody.ok) throw new Error(roleBody.error ?? "Không tải được roles");
      setUsers(userBody.users ?? []);
      setRoles(roleBody.roles ?? []);
      setUserError("");
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Không tải được dữ liệu admin");
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const downloadTemplate = (entity: string) => {
    window.open(`/api/templates/${entity}`, "_blank");
  };

  const uploadFile = async (entity: string, file?: File) => {
    if (!file) return;
    setUploading(entity);
    setResults((current) => ({ ...current, [entity]: { ok: true } }));

    try {
      const response = await fetch(`/api/import/${entity}`, {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-file-name": file.name,
        },
        body: await file.arrayBuffer()
      });
      const body = await response.json();
      setResults((current) => ({ ...current, [entity]: body }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [entity]: {
          ok: false,
          error: error instanceof Error ? error.message : "Upload thất bại"
        }
      }));
    } finally {
      setUploading(null);
    }
  };

  const editUser = (user: AdminUser) => {
    setForm({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone ?? "",
      role: user.role,
      status: user.status,
      saleCode: user.sale_code ?? ""
    });
  };

  const resetForm = () => setForm(emptyForm);

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingUser(true);
    setUserError("");
    try {
      const headers = await getAuthHeaders();
      const payload = {
        email: form.email,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        status: form.status,
        saleCode: form.saleCode
      };
      const response = await fetch(form.id ? `/api/users/${form.id}` : "/api/users", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          ...headers,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được user");
      await loadAdminData();
      resetForm();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Không lưu được user");
    } finally {
      setIsSavingUser(false);
    }
  };

  const deactivateUser = async (user: AdminUser) => {
    if (!window.confirm(`Khóa user ${user.email}?`)) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không khóa được user");
      await loadAdminData();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Không khóa được user");
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cấu hình hệ thống</h1>
        <p className="mt-1 text-sm text-gray-500">
          Khu vực bootstrap dữ liệu ban đầu: tải file mẫu, nhập dữ liệu và upload vào Supabase.
        </p>
      </div>

      <section className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-md bg-[#006B68]/10 p-2 text-[#006B68]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Quản lý user và phân quyền</h2>
            <p className="text-sm text-gray-500">Thêm email Google, gán role, khóa/mở tài khoản và mã sale.</p>
          </div>
        </div>

        {userError && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{userError}</div>}

        <form onSubmit={saveUser} className="mb-5 grid gap-3 md:grid-cols-6">
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            disabled={Boolean(form.id)}
            placeholder="Email Google"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68] md:col-span-2"
            required
          />
          <input
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            placeholder="Họ tên"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68] md:col-span-2"
            required
          />
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="SĐT"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
          />
          <input
            value={form.saleCode}
            onChange={(event) => setForm({ ...form, saleCode: event.target.value })}
            placeholder="Mã sale"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
          />
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
          >
            {roles.map((role) => (
              <option key={role.role} value={role.role}>{role.name}</option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68]"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={isSavingUser}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#006B68] px-3 py-2 text-sm font-medium text-white hover:bg-[#005a57] disabled:bg-gray-300"
            >
              {form.id ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isSavingUser ? "Đang lưu..." : form.id ? "Cập nhật user" : "Thêm user"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Họ tên</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Role</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.full_name}</td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2">{user.status}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => editUser(user)} className="mr-2 text-[#006B68] hover:underline">Sửa</button>
                    <button onClick={() => deactivateUser(user)} className="text-red-600 hover:underline">Khóa</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có user nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {importTargets.map((target) => {
          const result = results[target.entity];
          return (
            <section key={target.entity} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-md bg-gray-100 p-2 text-gray-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{target.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{target.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplate(target.entity)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Tải file mẫu
                </button>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#006B68] px-3 py-2 text-sm font-medium text-white hover:bg-[#005a57]">
                  <Upload className="h-4 w-4" />
                  {uploading === target.entity ? "Đang upload..." : "Upload file"}
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={uploading === target.entity}
                    className="hidden"
                    onChange={(event) => uploadFile(target.entity, event.target.files?.[0])}
                  />
                </label>
              </div>

              {result && (
                <div className={`mt-4 rounded-md p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  {result.error ? (
                    <div>{result.error}</div>
                  ) : (
                    <div>
                      <div>Batch: {result.batchId ?? "-"}</div>
                      <div>Tổng dòng: {result.totalRows ?? 0}</div>
                      <div>Thành công: {result.successRows ?? 0}</div>
                      <div>Lỗi: {result.failedRows ?? 0}</div>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
