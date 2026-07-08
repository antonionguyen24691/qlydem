import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Activity, Bell, Building2, CreditCard, Database, Download, Image as ImageIcon, Save, Upload, UserPlus, Users, Edit, Trash2 } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";
import { type BrandingSettings, defaultBranding, useBrandingStore } from "../store/branding";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const importTargets = [
  {
    entity: "customers",
    title: "Khách hàng",
    description: "Upload danh sách khách hàng, công nợ."
  },
  {
    entity: "suppliers",
    title: "Nhà cung cấp",
    description: "Upload nhà cung cấp, công nợ."
  },
  {
    entity: "products",
    title: "Hàng hóa",
    description: "Upload danh sách hàng hóa và giá."
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

type PaymentSettings = {
  enabled: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferTemplate: string;
};

type ReadinessTable = {
  table: string;
  ok: boolean;
  count: number;
  latencyMs: number;
  error?: string;
};

type ReadinessResult = {
  ready: boolean;
  checkedAt: string;
  missingTables: string[];
  tables: ReadinessTable[];
};

const defaultPayment: PaymentSettings = {
  enabled: false,
  bankBin: "",
  accountNumber: "",
  accountName: "",
  transferTemplate: "Thanh toan {orderCode}"
};

const vietQrBanks = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MBBank" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970416", name: "ACB" },
  { bin: "970448", name: "OCB" },
  { bin: "970441", name: "VIB" },
  { bin: "970426", name: "MSB" },
  { bin: "970443", name: "SHB" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970454", name: "Viet Capital Bank" },
  { bin: "970440", name: "SeABank" },
  { bin: "970428", name: "Nam A Bank" },
  { bin: "970414", name: "OceanBank" },
  { bin: "970452", name: "KienlongBank" }
];

const emptyForm = {
  id: "",
  email: "",
  fullName: "",
  phone: "",
  role: "SALE",
  status: "ACTIVE",
  saleCode: "",
  password: ""
};

function readImageFile(file?: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("File phải là ảnh."));
      return;
    }
    if (file.size > 500 * 1024) {
      reject(new Error("Ảnh nên nhỏ hơn 500KB để tải nhanh."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });
}

export function Settings() {
  const [activeSection, setActiveSection] = useState<"general" | "payment" | "users" | "data" | "operations">("general");
  const [uploading, setUploading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const branding = useBrandingStore((state) => state.branding);
  const loadBranding = useBrandingStore((state) => state.loadBranding);
  const saveBrandingSettings = useBrandingStore((state) => state.saveBranding);
  const [brandForm, setBrandForm] = useState<BrandingSettings>(defaultBranding);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [brandingError, setBrandingError] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [paymentForm, setPaymentForm] = useState<PaymentSettings>(defaultPayment);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supplierRows, setSupplierRows] = useState<any[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<any[]>([]);

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
    loadBranding();
    loadPayment();
  }, []);

  useEffect(() => {
    setBrandForm(branding);
  }, [branding]);

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
        saleCode: user.sale_code ?? "",
        password: ""
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
        saleCode: form.saleCode,
        password: form.password
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

  const updateBrandField = (key: keyof BrandingSettings, value: string) => {
    setBrandForm((current) => ({ ...current, [key]: value }));
    setBrandingMessage("");
    setBrandingError("");
  };

  const uploadBrandImage = async (key: "logoUrl" | "faviconUrl", event: ChangeEvent<HTMLInputElement>) => {
    try {
      const dataUrl = await readImageFile(event.target.files?.[0]);
      if (dataUrl) updateBrandField(key, dataUrl);
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : "Không đọc được ảnh");
    } finally {
      event.target.value = "";
    }
  };

  const saveBranding = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingBranding(true);
    setBrandingError("");
    setBrandingMessage("");
    try {
      await saveBrandingSettings(brandForm);
      setBrandingMessage("Đã lưu nhận diện app.");
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : "Không lưu được nhận diện app");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const loadPayment = async () => {
    try {
      const response = await fetch("/api/settings?key=payment");
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được cấu hình thanh toán");
      setPaymentForm({ ...defaultPayment, ...(body.payment ?? {}) });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không tải được cấu hình thanh toán");
    }
  };

  const savePayment = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingPayment(true);
    setPaymentError("");
    setPaymentMessage("");
    try {
      const response = await fetch("/api/settings?key=payment", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify(paymentForm)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được cấu hình thanh toán");
      setPaymentForm({ ...defaultPayment, ...(body.payment ?? paymentForm) });
      setPaymentMessage("Đã lưu cấu hình thanh toán và QR.");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không lưu được cấu hình thanh toán");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const loadOperations = async () => {
    setIsLoadingOperations(true);
    setOperationsError("");
    try {
      const headers = await getAuthHeaders();
      const [readinessResponse, auditResponse, supplierResponse, purchaseResponse] = await Promise.all([
        fetch("/api/operations/readiness", { headers }),
        fetch("/api/data/audit_logs", { headers }),
        fetch("/api/data/suppliers", { headers }),
        fetch("/api/data/purchase_orders", { headers })
      ]);
      const readinessBody = await readinessResponse.json();
      const auditBody = await auditResponse.json();
      const supplierBody = await supplierResponse.json();
      const purchaseBody = await purchaseResponse.json();
      if (!readinessResponse.ok || !readinessBody.ok) throw new Error(readinessBody.error ?? "Không kiểm tra được trạng thái vận hành.");
      if (!auditResponse.ok || !auditBody.ok) throw new Error(auditBody.error ?? "Không đọc được audit logs.");
      setReadiness(readinessBody);
      setAuditLogs((auditBody.rows ?? []).slice(0, 12));
      setSupplierRows((supplierBody.rows ?? []).slice(0, 8));
      setPurchaseRows((purchaseBody.rows ?? []).slice(0, 8));
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không tải được dữ liệu vận hành.");
    } finally {
      setIsLoadingOperations(false);
    }
  };

  const generateNotifications = async () => {
    setIsLoadingOperations(true);
    setOperationsError("");
    setOperationsMessage("");
    try {
      const response = await fetch("/api/operations/notifications", {
        method: "POST",
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tạo được thông báo.");
      setOperationsMessage(`Đã tạo ${body.created ?? 0} thông báo vận hành.`);
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không tạo được thông báo.");
    } finally {
      setIsLoadingOperations(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b border-zinc-200 gap-4 shrink-0">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Cài đặt hệ thống</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
        <div className="flex gap-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
          {[
            ["general", "Cấu hình chung"],
            ["payment", "Thanh toán QR"],
            ["users", "Người dùng"],
            ["data", "Dữ liệu & backup"],
            ["operations", "Vận hành"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key as typeof activeSection)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                activeSection === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Nhận diện App */}
        {activeSection === "general" && <section className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Thông tin doanh nghiệp</h2>
              <p className="text-sm text-zinc-500">Tên, logo và thông tin liên hệ của cửa hàng</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {brandingError && <div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">{brandingError}</div>}
            {brandingMessage && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{brandingMessage}</div>}

            <form onSubmit={saveBranding} className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Tên ứng dụng</label>
                  <Input value={brandForm.appName} onChange={e => updateBrandField("appName", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Tên công ty/Cửa hàng</label>
                  <Input value={brandForm.companyName} onChange={e => updateBrandField("companyName", e.target.value)} required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Địa chỉ</label>
                  <Input value={brandForm.address} onChange={e => updateBrandField("address", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Hotline</label>
                  <Input value={brandForm.hotline} onChange={e => updateBrandField("hotline", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Mã số thuế</label>
                  <Input value={brandForm.taxCode} onChange={e => updateBrandField("taxCode", e.target.value)} />
                </div>
                
                <div className="sm:col-span-2 pt-4 flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                    Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBrandImage("logoUrl", event)} />
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                    Upload Favicon
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBrandImage("faviconUrl", event)} />
                  </label>
                  <div className="flex-1 min-w-[200px] flex justify-end">
                    <Button type="submit" disabled={isSavingBranding} className="w-full sm:w-auto">
                      <Save className="h-4 w-4 mr-2" />
                      {isSavingBranding ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200 h-fit">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Xem trước</div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-zinc-100">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-600 text-white shadow-inner">
                    {brandForm.logoUrl ? <img src={brandForm.logoUrl} alt={brandForm.appName} className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-zinc-900 text-lg">{brandForm.appName || "PMQL"}</div>
                    <div className="truncate text-sm text-zinc-500 font-medium">{brandForm.companyName || "Tên công ty"}</div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </section>}

        {activeSection === "payment" && (
          <section className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Cấu hình thanh toán QR</h2>
                <p className="text-sm text-zinc-500">Thông tin này sẽ xuất hiện trên bill/phiếu xuất bán hàng.</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {paymentError && <div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">{paymentError}</div>}
              {paymentMessage && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{paymentMessage}</div>}
              <form onSubmit={savePayment} className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={paymentForm.enabled}
                    onChange={(event) => setPaymentForm({ ...paymentForm, enabled: event.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-bold text-zinc-800">Bật QR thanh toán trên bill</span>
                </label>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Mã ngân hàng VietQR/BIN</label>
                  <select
                    value={paymentForm.bankBin}
                    onChange={(event) => setPaymentForm({ ...paymentForm, bankBin: event.target.value })}
                    className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {vietQrBanks.map((bank) => (
                      <option key={bank.bin} value={bank.bin}>{bank.name} · {bank.bin}</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500">BIN đang lưu: {paymentForm.bankBin || "chưa chọn"}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Số tài khoản</label>
                  <Input value={paymentForm.accountNumber} onChange={(event) => setPaymentForm({ ...paymentForm, accountNumber: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Tên chủ tài khoản</label>
                  <Input value={paymentForm.accountName} onChange={(event) => setPaymentForm({ ...paymentForm, accountName: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Nội dung chuyển khoản</label>
                  <Input value={paymentForm.transferTemplate} onChange={(event) => setPaymentForm({ ...paymentForm, transferTemplate: event.target.value })} />
                  <p className="text-xs text-zinc-500">Dùng biến {"{orderCode}"} và {"{customerName}"}.</p>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={isSavingPayment}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingPayment ? "Đang lưu..." : "Lưu cấu hình thanh toán"}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Quản lý Nhân viên */}
        {activeSection === "users" && <section className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Phân quyền & Nhân viên</h2>
              <p className="text-sm text-zinc-500">Quản lý tài khoản truy cập hệ thống</p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {userError && <div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">{userError}</div>}

            <form onSubmit={saveUser} className="bg-zinc-50 rounded-xl p-4 sm:p-5 border border-zinc-200 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Email (*)</label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!form.id} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Họ tên (*)</label>
                  <Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Vai trò</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                    {roles.map((r) => <option key={r.role} value={r.role}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="flex h-11 sm:h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Khóa</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Mật khẩu mới</label>
                  <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={form.id ? "(Bỏ trống nếu không đổi)" : "Bắt buộc nếu login mật khẩu"} autoComplete="new-password" />
                </div>
              </div>
              
              <div className="mt-5 flex gap-3 justify-end border-t border-zinc-200 pt-5">
                {form.id && <Button type="button" variant="outline" onClick={resetForm}>Hủy</Button>}
                <Button type="submit" disabled={isSavingUser}>
                  {form.id ? <Save className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {isSavingUser ? "Đang lưu..." : form.id ? "Cập nhật nhân viên" : "Thêm nhân viên"}
                </Button>
              </div>
            </form>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Nhân viên</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Vai trò</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-5 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-zinc-900">{user.full_name}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-500">{user.email}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">{user.role}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => editUser(user)} className="text-emerald-600 hover:text-emerald-800 font-semibold p-2 rounded hover:bg-emerald-50 mr-1"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deactivateUser(user)} className="text-red-600 hover:text-red-800 font-semibold p-2 rounded hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">Chưa có nhân viên nào.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {users.map(user => (
                <div key={user.id} className="bg-white border border-zinc-200 p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-zinc-900">{user.full_name}</div>
                      <div className="text-sm text-zinc-500 mt-0.5">{user.email}</div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600 mb-4">{user.role}</div>
                  <div className="flex gap-2 border-t border-zinc-100 pt-3">
                    <Button variant="outline" className="flex-1" onClick={() => editUser(user)}><Edit className="w-4 h-4 mr-2"/> Sửa</Button>
                    <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50" onClick={() => deactivateUser(user)}><Trash2 className="w-4 h-4 mr-2"/> Xóa</Button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>}

        {/* Nhập/Xuất Dữ Liệu */}
        {activeSection === "data" && <section className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Dữ liệu & Tích hợp</h2>
              <p className="text-sm text-zinc-500">Nhập dữ liệu hàng loạt từ Excel</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {importTargets.map((target) => {
              const result = results[target.entity];
              return (
                <div key={target.entity} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-emerald-300 transition-colors shadow-sm flex flex-col h-full">
                  <div className="font-bold text-zinc-900 mb-1 text-base">{target.title}</div>
                  <p className="text-sm text-zinc-500 mb-5 flex-1">{target.description}</p>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => downloadTemplate(target.entity)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Tải mẫu Excel
                    </button>

                    <label className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm active:scale-[0.98]">
                      <Upload className="h-4 w-4" />
                      {uploading === target.entity ? "Đang tải lên..." : "Upload File"}
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
                    <div className={`mt-4 rounded-lg p-3 text-sm font-medium border ${result.ok ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-red-50 text-red-800 border-red-100"}`}>
                      {result.error ? (
                        <div>{result.error}</div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-emerald-700 font-bold mb-2">Thành công!</div>
                          <div className="flex justify-between"><span>Tổng dòng:</span> <span>{result.totalRows ?? 0}</span></div>
                          <div className="flex justify-between"><span>Lưu thành công:</span> <span className="text-emerald-600 font-bold">{result.successRows ?? 0}</span></div>
                          <div className="flex justify-between"><span>Lỗi:</span> <span className="text-red-600 font-bold">{result.failedRows ?? 0}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>}

        {activeSection === "operations" && <section className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex flex-col gap-3 bg-zinc-50/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Trung tâm vận hành</h2>
                <p className="text-sm text-zinc-500">Kiểm tra migration, thông báo, audit và các bảng chưa có màn riêng.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={loadOperations} disabled={isLoadingOperations}>
                <Activity className="mr-2 h-4 w-4" />
                {isLoadingOperations ? "Đang kiểm tra..." : "Kiểm tra"}
              </Button>
              <Button type="button" onClick={generateNotifications} disabled={isLoadingOperations}>
                <Bell className="mr-2 h-4 w-4" />
                Tạo nhắc việc
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {operationsError && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{operationsError}</div>}
            {operationsMessage && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{operationsMessage}</div>}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">Database readiness</div>
                <div className={`mt-2 text-2xl font-black ${readiness?.ready ? "text-emerald-600" : "text-red-600"}`}>
                  {!readiness ? "Chưa kiểm tra" : readiness.ready ? "Sẵn sàng" : "Thiếu bảng"}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {readiness ? `${readiness.tables.filter((item) => item.ok).length}/${readiness.tables.length} bảng OK` : "Bấm Kiểm tra để đối chiếu production schema."}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">Audit gần nhất</div>
                <div className="mt-2 text-2xl font-black text-zinc-900">{auditLogs.length}</div>
                <div className="mt-1 text-sm text-zinc-500">Dùng để truy vết thao tác quan trọng.</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">NCC / Đơn nhập</div>
                <div className="mt-2 text-2xl font-black text-zinc-900">{supplierRows.length} / {purchaseRows.length}</div>
                <div className="mt-1 text-sm text-zinc-500">Dữ liệu đã có bảng, chờ màn quản lý sâu.</div>
              </div>
            </div>

            {readiness && (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 font-bold text-zinc-900">Bảng production</div>
                <div className="max-h-80 overflow-auto custom-scrollbar">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                        <th className="px-4 py-2">Bảng</th>
                        <th className="px-4 py-2">Trạng thái</th>
                        <th className="px-4 py-2 text-right">Dòng</th>
                        <th className="px-4 py-2 text-right">ms</th>
                        <th className="px-4 py-2">Lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {readiness.tables.map((table) => (
                        <tr key={table.table}>
                          <td className="px-4 py-2 font-bold text-zinc-900">{table.table}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${table.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                              {table.ok ? "OK" : "Lỗi"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{table.count.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-zinc-500">{table.latencyMs}</td>
                          <td className="px-4 py-2 text-red-600">{table.error ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-3">
              <MiniOpsList title="Audit log" rows={auditLogs} primaryKey="action" secondaryKey="entity_type" dateKey="created_at" />
              <MiniOpsList title="Nhà cung cấp" rows={supplierRows} primaryKey="name" secondaryKey="phone" dateKey="created_at" />
              <MiniOpsList title="Đơn nhập" rows={purchaseRows} primaryKey="code" secondaryKey="status" dateKey="purchase_date" />
            </div>
          </div>
        </section>}

      </div>
    </div>
  );
}

function MiniOpsList({
  title,
  rows,
  primaryKey,
  secondaryKey,
  dateKey
}: {
  title: string;
  rows: any[];
  primaryKey: string;
  secondaryKey: string;
  dateKey: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 font-bold text-zinc-900">{title}</div>
      <div className="divide-y divide-zinc-100">
        {rows.map((row, index) => (
          <div key={row.id ?? index} className="p-4">
            <div className="line-clamp-1 font-bold text-zinc-900">{String(row[primaryKey] ?? row.code ?? row.id ?? "-")}</div>
            <div className="mt-1 line-clamp-1 text-sm text-zinc-500">{String(row[secondaryKey] ?? "")}</div>
            <div className="mt-2 text-xs font-medium text-zinc-400">{row[dateKey] ? new Date(row[dateKey]).toLocaleString("vi-VN") : ""}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Chưa có dữ liệu.</div>}
      </div>
    </div>
  );
}
