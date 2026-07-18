import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, Bell, Building2, Check, ChevronDown, ChevronRight, CreditCard, Database, Download, Image as ImageIcon, Plus, Save, Upload, UserPlus, Users, Edit, Trash2, RefreshCw } from "lucide-react";
import { getAuthHeaders } from "../lib/supabase";
import { type BrandingSettings, defaultBranding, useBrandingStore } from "../store/branding";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { permissionCatalog, permissionScopeFor, permissionScopeLabels, permissionScopes, type PermissionScope, withPermissionScope } from "../lib/permissionCatalog";
import { ThemeSettingsSection } from "../components/settings/ThemeSettingsSection";
import { useThemeStore } from "../store/theme";
import { useDataStore } from "../store/data";

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

const permissionGroups = [
  { key: "sales", label: "Bán hàng & đơn hàng", permissions: ["dashboard.view", "pos.use", "orders.view", "orders.create", "orders.price_override"] },
  { key: "partners", label: "Khách hàng & hàng hóa", permissions: ["customers.view", "customers.create", "customers.update", "products.view", "products.manage"] },
  { key: "inventory", label: "Kho & nhập hàng", permissions: ["inventory.view", "inventory.manage"] },
  { key: "finance", label: "Tài chính & công nợ", permissions: ["finance.view", "finance.receipt.create", "finance.expense.create", "finance.fund.manage", "finance.export"] },
  { key: "administration", label: "Người dùng & cấu hình", permissions: ["settings.manage", "users.manage"] },
  { key: "data", label: "Dữ liệu & lịch sử", permissions: ["data.import", "history.clear"] }
] as const;

type ImportResult = {
  ok: boolean;
  batchId?: string;
  totalRows?: number;
  successRows?: number;
  failedRows?: number;
  error?: string;
};

type SheetChangeRequest = {
  id: string;
  entity_type: string;
  target_code: string;
  field_name: string;
  proposed_value: unknown;
  expected_updated_at?: string;
  note?: string;
  status: string;
  submitted_at: string;
  error_message?: string;
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

type UnitSettings = {
  units: Array<{
    code: string;
    name: string;
    baseCode?: string;
    factor?: number;
  }>;
};

type InventoryOperationSettings = {
  operations: Array<{
    code: string;
    name: string;
    direction: "IN" | "OUT" | "COUNT";
    costingMethod?: string;
  }>;
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

const defaultUnits: UnitSettings = {
  units: [
    { code: "HỘP", name: "Hộp", factor: 1 },
    { code: "VIÊN", name: "Viên", baseCode: "HỘP", factor: 1 },
    { code: "M2", name: "Mét vuông", baseCode: "HỘP", factor: 1 }
  ]
};

const defaultInventoryOperations: InventoryOperationSettings = {
  operations: [
    { code: "PURCHASE_IN", name: "Nhập mua hàng", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "RETURN_IN", name: "Nhập hàng trả lại", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "SALE_OUT", name: "Xuất bán hàng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "DAMAGE_OUT", name: "Xuất hao hụt/hư hỏng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "STOCK_COUNT", name: "Kiểm kê điều chỉnh", direction: "COUNT", costingMethod: "WEIGHTED_AVERAGE" }
  ]
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

const historyClearOptions = [
  { key: "sales", label: "Lịch sử đơn hàng bán", description: "Đơn bán, dòng hàng, công nợ gắn với đơn." },
  { key: "finance", label: "Lịch sử thu tiền/công nợ", description: "Phiếu thu, sổ quỹ, nhắc nợ và phân bổ thu." },
  { key: "purchase", label: "Lịch sử mua/nhập hàng", description: "Đơn nhập mua và công nợ nhà cung cấp." },
  { key: "inventory", label: "Lịch sử xuất/nhập/kiểm kho", description: "Giao dịch kho, lệnh duyệt kiểm kê, log sửa tồn." },
  { key: "notifications", label: "Thông báo và nhắc việc", description: "Thông báo nội bộ và các nhắc việc công nợ." },
  { key: "imports", label: "Lịch sử import dữ liệu", description: "Batch import và lỗi import Excel." },
  { key: "cancelled-orders", label: "Đơn đã hủy (xóa vĩnh viễn)", description: "Dọn các đơn trạng thái Đã hủy khỏi danh sách + sổ sách gắn với đơn. Phiếu thu/sổ quỹ giữ nguyên." }
];

const masterClearOptions = [
  { key: "master-customers", label: "DANH MỤC khách hàng", description: "Xóa toàn bộ khách hàng + liên hệ. Cần xóa sạch lịch sử bán/công nợ trước." },
  { key: "master-suppliers", label: "DANH MỤC nhà cung cấp", description: "Xóa toàn bộ NCC. Cần xóa sạch lịch sử mua/nhập hàng trước." },
  { key: "master-products", label: "DANH MỤC sản phẩm & tồn kho", description: "Xóa toàn bộ hàng hóa, tồn kho, lịch sử giá. Cần xóa sạch lịch sử bán + kho trước." }
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
  const themeId = useThemeStore((state) => state.themeId);
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<"general" | "payment" | "units" | "users" | "data" | "operations" | "appearance">("general");
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
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [openPermissionGroups, setOpenPermissionGroups] = useState<Record<string, boolean>>({ sales: true });
  const [form, setForm] = useState(emptyForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [paymentForm, setPaymentForm] = useState<PaymentSettings>(defaultPayment);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [unitForm, setUnitForm] = useState<UnitSettings>(defaultUnits);
  const [unitMessage, setUnitMessage] = useState("");
  const [unitError, setUnitError] = useState("");
  const [isSavingUnits, setIsSavingUnits] = useState(false);
  const [inventoryOperationForm, setInventoryOperationForm] = useState<InventoryOperationSettings>(defaultInventoryOperations);
  const [isSavingInventoryOperations, setIsSavingInventoryOperations] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supplierRows, setSupplierRows] = useState<any[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<any[]>([]);
  const [clearHistoryGroups, setClearHistoryGroups] = useState<string[]>([]);
  const [clearHistoryConfirmation, setClearHistoryConfirmation] = useState("");
  const [clearHistoryResult, setClearHistoryResult] = useState<Record<string, number> | null>(null);
  const loadLiveData = useDataStore((state) => state.loadLiveData);
  const [historyArchives, setHistoryArchives] = useState<Array<{ id: string; groups: string[]; row_counts: Record<string, number>; created_at: string }>>([]);
  const [downloadingArchiveId, setDownloadingArchiveId] = useState("");
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetChangeRequests, setSheetChangeRequests] = useState<SheetChangeRequest[]>([]);
  const [isLoadingSheetChanges, setIsLoadingSheetChanges] = useState(false);
  const [reviewingSheetChangeId, setReviewingSheetChangeId] = useState("");
  const [sheetChangeError, setSheetChangeError] = useState("");

  useEffect(() => {
    const section = new URLSearchParams(location.search).get("section");
    if (section === "operations") {
      navigate("/settings/operations", { replace: true });
      return;
    }
    if (section && ["general", "payment", "units", "users", "data", "operations", "appearance"].includes(section)) {
      setActiveSection(section as "general" | "payment" | "units" | "users" | "data" | "operations" | "appearance");
    }
  }, [location.search]);

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
    loadUnits();
    loadInventoryOperations();
  }, []);

  useEffect(() => {
    setBrandForm(branding);
  }, [branding]);

  const downloadTemplate = (entity: string) => {
    window.open(`/api/templates/${entity}`, "_blank");
  };

  const uploadFile = async (entity: string, file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setResults((current) => ({ ...current, [entity]: { ok: false, error: "File vượt giới hạn 10 MB." } }));
      return;
    }
    setUploading(entity);
    setResults((current) => ({ ...current, [entity]: { ok: true } }));

    try {
      const headers = {
        ...(await getAuthHeaders()),
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-file-name": file.name,
      };
      const dryRunResponse = await fetch(`/api/import/${entity}?dryRun=true`, {
        method: "POST",
        headers: { ...headers, "x-import-dry-run": "true" },
        body: await file.arrayBuffer()
      });
      const dryRun = await dryRunResponse.json();
      if (!dryRunResponse.ok || !dryRun.ok) throw new Error(dryRun.error ?? "Không kiểm tra được file import.");
      const shouldImport = window.confirm(
        `Kiểm tra file: ${Number(dryRun.totalRows ?? 0).toLocaleString("vi-VN")} dòng, ` +
        `${Number(dryRun.validRows ?? dryRun.totalRows ?? 0).toLocaleString("vi-VN")} dòng hợp lệ, ` +
        `${Number(dryRun.failedRows ?? 0).toLocaleString("vi-VN")} dòng lỗi.\n\nBạn có muốn ghi dữ liệu thật không?`
      );
      if (!shouldImport) {
        setResults((current) => ({ ...current, [entity]: { ok: true, totalRows: dryRun.totalRows, successRows: 0, failedRows: dryRun.failedRows } }));
        return;
      }
      const response = await fetch(`/api/import/${entity}`, {
        method: "POST",
        headers,
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

  const syncGoogleSheetsNow = async () => {
    setIsSyncingSheets(true);
    setSyncMessage("");
    setSyncError("");
    try {
      const response = await fetch("/api/sync/google-sheets", {
        method: "POST",
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không đồng bộ được Google Sheet.");
      setSyncMessage(`Đã đồng bộ ${body.synced?.length ?? 0} bảng lúc ${new Date(body.syncedAt ?? Date.now()).toLocaleString("vi-VN")}.`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Không đồng bộ được Google Sheet.");
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const loadGoogleSheetChanges = async () => {
    setIsLoadingSheetChanges(true);
    setSheetChangeError("");
    try {
      const response = await fetch("/api/data/sheet-inbox", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được yêu cầu từ Google Sheet.");
      setSheetChangeRequests(body.requests ?? []);
    } catch (error) {
      setSheetChangeError(error instanceof Error ? error.message : "Không tải được yêu cầu từ Google Sheet.");
    } finally {
      setIsLoadingSheetChanges(false);
    }
  };

  const reviewGoogleSheetChange = async (id: string, decision: "APPROVE" | "REJECT") => {
    setReviewingSheetChangeId(id);
    setSheetChangeError("");
    try {
      const response = await fetch("/api/data/sheet-inbox", {
        method: "PATCH",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ id, decision })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không xử lý được yêu cầu đồng bộ ngược.");
      await Promise.all([loadGoogleSheetChanges(), loadLiveData()]);
    } catch (error) {
      setSheetChangeError(error instanceof Error ? error.message : "Không xử lý được yêu cầu đồng bộ ngược.");
    } finally {
      setReviewingSheetChangeId("");
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

  const updateRolePermission = (roleCode: string, permission: string, scope: PermissionScope) => {
    setRoles((current) => current.map((role) => role.role === roleCode
      ? { ...role, permissions_json: withPermissionScope(role.permissions_json, permission, scope) }
      : role));
  };

  const togglePermissionGroup = (group: string) => {
    setOpenPermissionGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  const toggleRolePermission = (role: Role, permission: string) => {
    const currentScope = permissionScopeFor(role.role, role.permissions_json, permission);
    updateRolePermission(role.role, permission, currentScope === "none" ? "own" : "none");
  };

  const saveRolePermissions = async (role: Role) => {
    setSavingRole(role.role);
    setUserError("");
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "content-type": "application/json" },
        body: JSON.stringify({ role: role.role, name: role.name, permissionsJson: role.permissions_json })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được ma trận quyền.");
      setRoles((current) => current.map((item) => item.role === role.role ? body.role : item));
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Không lưu được ma trận quyền.");
    } finally {
      setSavingRole(null);
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
      const response = await fetch("/api/settings?key=payment", { headers: await getAuthHeaders() });
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

  const loadUnits = async () => {
    try {
      const response = await fetch("/api/settings?key=units", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được đơn vị tính");
      setUnitForm({ ...defaultUnits, ...(body.units ?? {}) });
    } catch (error) {
      setUnitError(error instanceof Error ? error.message : "Không tải được đơn vị tính");
    }
  };

  const saveUnits = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingUnits(true);
    setUnitError("");
    setUnitMessage("");
    try {
      const response = await fetch("/api/settings?key=units", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify(unitForm)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được đơn vị tính");
      setUnitForm({ ...defaultUnits, ...(body.units ?? unitForm) });
      setUnitMessage("Đã lưu danh sách đơn vị tính.");
    } catch (error) {
      setUnitError(error instanceof Error ? error.message : "Không lưu được đơn vị tính");
    } finally {
      setIsSavingUnits(false);
    }
  };

  const loadInventoryOperations = async () => {
    try {
      const response = await fetch("/api/settings?key=inventoryOperations", { headers: await getAuthHeaders() });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được hình thức kho");
      setInventoryOperationForm({ ...defaultInventoryOperations, ...(body.inventoryOperations ?? {}) });
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không tải được hình thức kho");
    }
  };

  const saveInventoryOperations = async () => {
    setIsSavingInventoryOperations(true);
    setOperationsError("");
    setOperationsMessage("");
    try {
      const response = await fetch("/api/settings?key=inventoryOperations", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...inventoryOperationForm
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không lưu được hình thức kho");
      setInventoryOperationForm({ ...defaultInventoryOperations, ...(body.inventoryOperations ?? inventoryOperationForm) });
      setOperationsMessage("Đã lưu cấu hình hình thức nhập/xuất kho.");
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không lưu được hình thức kho");
    } finally {
      setIsSavingInventoryOperations(false);
    }
  };

  const loadOperations = async () => {
    setIsLoadingOperations(true);
    setOperationsError("");
    try {
      const headers = await getAuthHeaders();
      const [readinessResponse, auditResponse, supplierResponse, purchaseResponse, archivesResponse] = await Promise.all([
        fetch("/api/operations/readiness", { headers }),
        fetch("/api/data/audit_logs", { headers }),
        fetch("/api/data/suppliers", { headers }),
        fetch("/api/data/purchase_orders", { headers }),
        fetch("/api/operations/clear-history-archives", { headers })
      ]);
      const readinessBody = await readinessResponse.json();
      const auditBody = await auditResponse.json();
      const supplierBody = await supplierResponse.json();
      const purchaseBody = await purchaseResponse.json();
      const archivesBody = await archivesResponse.json();
      if (!readinessResponse.ok || !readinessBody.ok) throw new Error(readinessBody.error ?? "Không kiểm tra được trạng thái vận hành.");
      if (!auditResponse.ok || !auditBody.ok) throw new Error(auditBody.error ?? "Không đọc được audit logs.");
      setReadiness(readinessBody);
      setAuditLogs((auditBody.rows ?? []).slice(0, 500));
      setSupplierRows((supplierBody.rows ?? []).slice(0, 8));
      setPurchaseRows((purchaseBody.rows ?? []).slice(0, 8));
      if (archivesResponse.ok && archivesBody.ok) setHistoryArchives(archivesBody.archives ?? []);
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

  const toggleClearHistoryGroup = (key: string) => {
    setClearHistoryGroups((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
    setClearHistoryResult(null);
    setOperationsError("");
    setOperationsMessage("");
  };

  const clearSelectedHistory = async () => {
    if (clearHistoryGroups.length === 0) {
      setOperationsError("Chưa chọn nhóm lịch sử cần xóa.");
      return;
    }
    if (clearHistoryConfirmation.trim().toUpperCase() !== "XOA") {
      setOperationsError("Vui lòng nhập XOA để xác nhận xóa lịch sử.");
      return;
    }
    const labels = [...historyClearOptions, ...masterClearOptions]
      .filter((item) => clearHistoryGroups.includes(item.key))
      .map((item) => item.label)
      .join(", ");
    if (!window.confirm(`Xóa vĩnh viễn các nhóm: ${labels}?`)) return;
    const selectedMasterLabels = masterClearOptions
      .filter((item) => clearHistoryGroups.includes(item.key))
      .map((item) => item.label);
    if (selectedMasterLabels.length > 0 && !window.confirm(
      `⚠️ CẢNH BÁO: Bạn sắp xóa toàn bộ ${selectedMasterLabels.join(", ")}.\n\nĐây là dữ liệu danh mục gốc, xóa xong KHÔNG thể hoàn tác trong app (chỉ còn bản lưu JSON). Bấm OK để xác nhận lần cuối.`
    )) return;

    setIsClearingHistory(true);
    setOperationsError("");
    setOperationsMessage("");
    setClearHistoryResult(null);
    try {
      const response = await fetch("/api/operations/clear-history", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          groups: clearHistoryGroups,
          confirmation: clearHistoryConfirmation
        })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không xóa được lịch sử.");
      setClearHistoryResult(body.deleted ?? {});
      const resynced = body.resynced ?? {};
      const resyncParts = [
        resynced.customerDebts > 0 ? `${resynced.customerDebts} công nợ khách` : "",
        resynced.supplierPayables > 0 ? `${resynced.supplierPayables} công nợ NCC` : "",
        resynced.settledOrders > 0 ? `${resynced.settledOrders} đơn tất toán` : "",
        resynced.customerSalesStats > 0 ? `${resynced.customerSalesStats} doanh thu KH` : ""
      ].filter(Boolean);
      setOperationsMessage(
        `Đã xóa ${Number(body.totalDeleted ?? 0).toLocaleString()} dòng lịch sử.` +
        (resyncParts.length > 0 ? ` Đã đồng bộ lại số dư: ${resyncParts.join(", ")}.` : "")
      );
      setClearHistoryConfirmation("");
      // Tải lại dữ liệu app ngay để các trang (Tài chính, Đơn hàng...) không hiển thị số cũ.
      await Promise.all([loadOperations(), loadLiveData()]);
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không xóa được lịch sử.");
    } finally {
      setIsClearingHistory(false);
    }
  };

  const downloadHistoryArchive = async (archiveId: string) => {
    setDownloadingArchiveId(archiveId);
    setOperationsError("");
    try {
      const response = await fetch(`/api/operations/clear-history-archives?id=${encodeURIComponent(archiveId)}`, {
        headers: await getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Không tải được bản lưu.");
      const blob = new Blob([JSON.stringify(body.archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `backup-truoc-khi-xoa-${String(body.archive?.created_at ?? "").slice(0, 10)}-${archiveId.slice(0, 8)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Không tải được bản lưu.");
    } finally {
      setDownloadingArchiveId("");
    }
  };

  return (
    <div data-mobile-page="settings" data-mobile-theme={themeId} className="mobile-mockup-page flex h-full flex-col bg-zinc-50 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 sm:px-6 py-4 border-b border-zinc-200 gap-4 shrink-0">
        <h1 className="text-xl font-bold text-zinc-900 text-center sm:text-left">Cài đặt hệ thống</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
        <div className="flex gap-2 overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200 bg-white p-2 shadow-sm">
          {[
            ["general", "Cấu hình chung"],
            ["payment", "Thanh toán QR"],
            ["units", "Đơn vị tính"],
            ["users", "Người dùng"],
            ["data", "Dữ liệu & backup"],
            ["operations", "Vận hành"],
            ["appearance", "Giao diện"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => key === "operations" ? navigate("/settings/operations") : setActiveSection(key as typeof activeSection)}
              className={`whitespace-nowrap rounded-[var(--radius-control)] px-4 py-2 text-sm font-bold transition-colors ${
                activeSection === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Nhận diện App */}
        {activeSection === "general" && <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Thông tin doanh nghiệp</h2>
              <p className="text-sm text-zinc-500">Tên, logo và thông tin liên hệ của cửa hàng</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {brandingError && <div className="mb-4 rounded-[var(--radius-control)] bg-red-50 border border-red-100 p-3 text-sm text-red-700">{brandingError}</div>}
            {brandingMessage && <div className="mb-4 rounded-[var(--radius-control)] bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{brandingMessage}</div>}

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
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                    Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBrandImage("logoUrl", event)} />
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
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
              <div className="bg-zinc-50 rounded-[var(--radius-card)] p-5 border border-zinc-200 h-fit">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Xem trước</div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-[var(--radius-card)] shadow-sm border border-zinc-100">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-emerald-600 text-white shadow-inner">
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
          <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
              <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Cấu hình thanh toán QR</h2>
                <p className="text-sm text-zinc-500">Thông tin này sẽ xuất hiện trên bill/phiếu xuất bán hàng.</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {paymentError && <div className="mb-4 rounded-[var(--radius-control)] bg-red-50 border border-red-100 p-3 text-sm text-red-700">{paymentError}</div>}
              {paymentMessage && <div className="mb-4 rounded-[var(--radius-control)] bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{paymentMessage}</div>}
              <form onSubmit={savePayment} className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[var(--radius-control)] border border-zinc-200 bg-zinc-50 p-3 sm:col-span-2">
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
                    className="flex h-11 sm:h-10 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
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

        {activeSection === "units" && (
          <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
              <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Đơn vị tính & quy đổi</h2>
                <p className="text-sm text-zinc-500">Danh sách đơn vị dùng khi tạo hàng hóa và in phiếu.</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {unitError && <div className="mb-4 rounded-[var(--radius-control)] bg-red-50 border border-red-100 p-3 text-sm text-red-700">{unitError}</div>}
              {unitMessage && <div className="mb-4 rounded-[var(--radius-control)] bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{unitMessage}</div>}
              <form onSubmit={saveUnits} className="space-y-4">
                <div className="overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Mã ĐVT</th>
                        <th className="px-4 py-3 text-left">Tên hiển thị</th>
                        <th className="px-4 py-3 text-left">Quy đổi về</th>
                        <th className="px-4 py-3 text-right">Hệ số</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {unitForm.units.map((unit, index) => (
                        <tr key={`${unit.code}-${index}`}>
                          <td className="px-4 py-3">
                            <Input
                              value={unit.code}
                              onChange={(event) =>
                                setUnitForm((current) => ({
                                  units: current.units.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, code: event.target.value.toUpperCase() } : item
                                  )
                                }))
                              }
                              required
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={unit.name}
                              onChange={(event) =>
                                setUnitForm((current) => ({
                                  units: current.units.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, name: event.target.value } : item
                                  )
                                }))
                              }
                              required
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={unit.baseCode ?? ""}
                              onChange={(event) =>
                                setUnitForm((current) => ({
                                  units: current.units.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, baseCode: event.target.value || undefined } : item
                                  )
                                }))
                              }
                              className="h-11 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:h-10 sm:text-sm"
                            >
                              <option value="">Chính nó</option>
                              {unitForm.units
                                .filter((item, itemIndex) => itemIndex !== index && item.code.trim())
                                .map((item) => (
                                  <option key={item.code} value={item.code}>{item.name || item.code}</option>
                                ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={unit.factor ?? ""}
                              onChange={(event) =>
                                setUnitForm((current) => ({
                                  units: current.units.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, factor: Number(event.target.value) || 1 } : item
                                  )
                                }))
                              }
                              className="text-right"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setUnitForm((current) => ({
                                  units: current.units.filter((_, itemIndex) => itemIndex !== index)
                                }))
                              }
                              className="rounded-[var(--radius-control)] p-2 text-red-600 hover:bg-red-50"
                              title="Xóa đơn vị"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setUnitForm((current) => ({
                        units: [...current.units, { code: "", name: "", factor: 1 }]
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm đơn vị
                  </Button>
                  <Button type="submit" disabled={isSavingUnits || unitForm.units.length === 0}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingUnits ? "Đang lưu..." : "Lưu đơn vị tính"}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Quản lý Nhân viên */}
        {activeSection === "users" && <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Phân quyền & Nhân viên</h2>
              <p className="text-sm text-zinc-500">Quản lý tài khoản truy cập hệ thống</p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {userError && <div className="mb-4 rounded-[var(--radius-control)] bg-red-50 border border-red-100 p-3 text-sm text-red-700">{userError}</div>}

            <form onSubmit={saveUser} className="bg-zinc-50 rounded-[var(--radius-card)] p-4 sm:p-5 border border-zinc-200 mb-6">
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
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="flex h-11 sm:h-10 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                    {roles.map((r) => <option key={r.role} value={r.role}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-700">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="flex h-11 sm:h-10 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
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
            <div className="hidden sm:block overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200 shadow-sm">
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
                <div key={user.id} className="bg-white border border-zinc-200 p-4 rounded-[var(--radius-card)] shadow-sm">
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

            <div className="mt-8 rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-base font-black text-zinc-900">Ma trận quyền thao tác</h3>
                <p className="mt-1 text-sm text-zinc-500">Quyền được kiểm tra ở backend. “Của mình” áp dụng cho dữ liệu sale được gán/phát sinh bởi user đó.</p>
              </div>
              <div className="space-y-4">
                {roles.map((role) => (
                  <div key={role.role} className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-3 sm:p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-black text-zinc-900">{role.name}</div>
                        <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">{role.role}</div>
                      </div>
                      <Button type="button" size="sm" onClick={() => saveRolePermissions(role)} disabled={role.role === "ADMIN" || savingRole === role.role}>
                        <Save className="mr-1.5 h-4 w-4" />
                        {savingRole === role.role ? "Đang lưu..." : "Lưu quyền"}
                      </Button>
                    </div>
                    {role.role === "ADMIN" ? (
                      <div className="rounded-[var(--radius-control)] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">ADMIN luôn có toàn quyền; không thể hạ quyền từ màn này.</div>
                    ) : (
                      <div className="space-y-2">
                        {permissionGroups.map((group) => {
                          const groupPermissions = permissionCatalog.filter((permission) => group.permissions.includes(permission.key as never));
                          const enabledCount = groupPermissions.filter((permission) => permissionScopeFor(role.role, role.permissions_json, permission.key) !== "none").length;
                          const isOpen = Boolean(openPermissionGroups[group.key]);
                          return (
                            <div key={group.key} className="overflow-hidden rounded-[var(--radius-control)] border border-zinc-200">
                              <button
                                type="button"
                                onClick={() => togglePermissionGroup(group.key)}
                                aria-expanded={isOpen}
                                className="flex w-full items-center justify-between gap-3 bg-zinc-50 px-3 py-2.5 text-left hover:bg-zinc-100"
                              >
                                <span className="flex items-center gap-2 font-bold text-zinc-800">
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  {group.label}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${enabledCount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>
                                  {enabledCount}/{groupPermissions.length} quyền bật
                                </span>
                              </button>
                              {isOpen && (
                                <div className="divide-y divide-zinc-100 bg-white">
                                  {groupPermissions.map((permission) => {
                                    const scope = permissionScopeFor(role.role, role.permissions_json, permission.key);
                                    const enabled = scope !== "none";
                                    return (
                                      <div key={permission.key} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center">
                                        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-zinc-800">
                                          <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={() => toggleRolePermission(role, permission.key)}
                                            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
                                          />
                                          <span className="flex items-center gap-2">
                                            {enabled && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
                                            {permission.label}
                                          </span>
                                        </label>
                                        <select
                                          aria-label={`Phạm vi ${permission.label}`}
                                          value={scope}
                                          disabled={!enabled}
                                          onChange={(event) => updateRolePermission(role.role, permission.key, event.target.value as PermissionScope)}
                                          className="h-9 w-full rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                                        >
                                          {permissionScopes.map((option) => <option key={option} value={option}>{permissionScopeLabels[option]}</option>)}
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>}

        {/* Nhập/Xuất Dữ Liệu */}
        {activeSection === "data" && <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
            <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">Dữ liệu & Tích hợp</h2>
              <p className="text-sm text-zinc-500">Nhập dữ liệu hàng loạt từ Excel</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 space-y-4">
            {syncError && <div className="rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{syncError}</div>}
            {syncMessage && <div className="rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{syncMessage}</div>}
            <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-4 sm:flex sm:items-center sm:justify-between">
              <div>
                <div className="font-bold text-zinc-900">Đồng bộ Google Sheet thủ công</div>
                <div className="mt-1 text-sm text-zinc-500">POS và thu tiền sẽ ưu tiên ghi Supabase trước; Sheet chỉ chạy khi admin bấm hoặc theo cron đã cấu hình.</div>
              </div>
              <Button type="button" onClick={syncGoogleSheetsNow} disabled={isSyncingSheets} className="mt-3 w-full sm:mt-0 sm:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" />
                {isSyncingSheets ? "Đang đồng bộ..." : "Đồng bộ ngay"}
              </Button>
            </div>
            <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-bold text-zinc-900">Hàng chờ đồng bộ ngược từ Google Sheet</div>
                  <p className="mt-1 text-sm text-zinc-600">Chỉ nhận thay đổi danh mục từ tab <code>PMQL_change_inbox</code>. Đơn hàng, phiếu thu/chi, công nợ và tồn kho không được phép ghi ngược từ Sheet.</p>
                </div>
                <Button type="button" variant="outline" onClick={loadGoogleSheetChanges} disabled={isLoadingSheetChanges} className="w-full shrink-0 sm:w-auto">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isLoadingSheetChanges ? "Đang tải..." : "Tải yêu cầu"}
                </Button>
              </div>
              {sheetChangeError && <div className="mt-3 rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{sheetChangeError}</div>}
              {sheetChangeRequests.length > 0 && <div className="mt-3 overflow-x-auto rounded-[var(--radius-control)] border border-amber-100 bg-white">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="bg-amber-50 text-left text-xs uppercase tracking-wide text-zinc-600"><tr><th className="px-3 py-2">Danh mục</th><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Thay đổi đề xuất</th><th className="px-3 py-2">Gửi lúc</th><th className="px-3 py-2 text-right">Duyệt</th></tr></thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sheetChangeRequests.map((request) => <tr key={request.id}>
                      <td className="px-3 py-2 font-semibold text-zinc-800">{request.entity_type}</td>
                      <td className="px-3 py-2 font-mono text-emerald-700">{request.target_code}</td>
                      <td className="px-3 py-2"><span className="font-semibold">{request.field_name}</span>: {typeof request.proposed_value === "string" ? request.proposed_value : JSON.stringify(request.proposed_value)}{request.note ? <div className="mt-1 text-xs text-zinc-500">{request.note}</div> : null}</td>
                      <td className="px-3 py-2 text-zinc-500">{new Date(request.submitted_at).toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-2 text-right">{request.status === "PENDING" ? <div className="inline-flex gap-2"><Button type="button" size="sm" variant="outline" disabled={reviewingSheetChangeId === request.id} onClick={() => reviewGoogleSheetChange(request.id, "REJECT")}>Từ chối</Button><Button type="button" size="sm" disabled={reviewingSheetChangeId === request.id} onClick={() => reviewGoogleSheetChange(request.id, "APPROVE")}>{reviewingSheetChangeId === request.id ? "Đang xử lý..." : "Áp dụng"}</Button></div> : <span className="text-xs font-bold text-zinc-500">{request.status}</span>}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {importTargets.map((target) => {
                const result = results[target.entity];
                return (
                  <div key={target.entity} className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-5 hover:border-emerald-300 transition-colors shadow-sm flex flex-col h-full">
                    <div className="font-bold text-zinc-900 mb-1 text-base">{target.title}</div>
                    <p className="text-sm text-zinc-500 mb-5 flex-1">{target.description}</p>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTemplate(target.entity)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Tải mẫu Excel
                      </button>

                      <label className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm active:scale-[0.98]">
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
                      <div className={`mt-4 rounded-[var(--radius-control)] p-3 text-sm font-medium border ${result.ok ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-red-50 text-red-800 border-red-100"}`}>
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
          </div>
        </section>}

        {activeSection === "operations" && <section className="bg-white rounded-[var(--radius-card)] shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex flex-col gap-3 bg-zinc-50/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-[var(--radius-control)] text-emerald-700">
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
            {operationsError && <div className="rounded-[var(--radius-control)] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{operationsError}</div>}
            {operationsMessage && <div className="rounded-[var(--radius-control)] border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{operationsMessage}</div>}

            <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-black text-zinc-900">Hình thức nhập/xuất kho</div>
                  <div className="mt-1 text-sm text-zinc-500">Admin cấu hình loại phiếu để phân loại nhập mua, trả hàng, xuất bán, hao hụt và kiểm kê.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInventoryOperationForm((current) => ({
                    operations: [
                      ...current.operations,
                      { code: "", name: "", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" }
                    ]
                  }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm hình thức
                </Button>
              </div>

              <div className="space-y-3">
                {inventoryOperationForm.operations.map((operation, index) => (
                  <div key={`${operation.code}-${index}`} className="grid gap-3 rounded-[var(--radius-card)] border border-zinc-100 bg-zinc-50 p-3 lg:grid-cols-[160px_1fr_150px_190px_auto]">
                    <Input
                      value={operation.code}
                      onChange={(event) => setInventoryOperationForm((current) => ({
                        operations: current.operations.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value.toUpperCase().replace(/\s+/g, "_") } : item)
                      }))}
                      placeholder="Mã"
                    />
                    <Input
                      value={operation.name}
                      onChange={(event) => setInventoryOperationForm((current) => ({
                        operations: current.operations.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)
                      }))}
                      placeholder="Tên hiển thị"
                    />
                    <select
                      value={operation.direction}
                      onChange={(event) => setInventoryOperationForm((current) => ({
                        operations: current.operations.map((item, itemIndex) => itemIndex === index ? { ...item, direction: event.target.value as "IN" | "OUT" | "COUNT" } : item)
                      }))}
                      className="h-11 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:h-10 sm:text-sm"
                    >
                      <option value="IN">Nhập kho</option>
                      <option value="OUT">Xuất kho</option>
                      <option value="COUNT">Kiểm kê</option>
                    </select>
                    <select
                      value={operation.costingMethod ?? "WEIGHTED_AVERAGE"}
                      onChange={(event) => setInventoryOperationForm((current) => ({
                        operations: current.operations.map((item, itemIndex) => itemIndex === index ? { ...item, costingMethod: event.target.value } : item)
                      }))}
                      className="h-11 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-emerald-600 sm:h-10 sm:text-sm"
                    >
                      <option value="WEIGHTED_AVERAGE">Bình quân gia quyền</option>
                      <option value="FIFO">FIFO</option>
                      <option value="LOT">Theo lô cụ thể</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => setInventoryOperationForm((current) => ({
                        operations: current.operations.filter((_, itemIndex) => itemIndex !== index)
                      }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={saveInventoryOperations} disabled={isSavingInventoryOperations || inventoryOperationForm.operations.length === 0}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingInventoryOperations ? "Đang lưu..." : "Lưu hình thức kho"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">Database readiness</div>
                <div className={`mt-2 text-2xl font-black ${readiness?.ready ? "text-emerald-600" : "text-red-600"}`}>
                  {!readiness ? "Chưa kiểm tra" : readiness.ready ? "Sẵn sàng" : "Thiếu bảng"}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {readiness ? `${readiness.tables.filter((item) => item.ok).length}/${readiness.tables.length} bảng OK` : "Bấm Kiểm tra để đối chiếu production schema."}
                </div>
              </div>
              <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">Audit gần nhất</div>
                <div className="mt-2 text-2xl font-black text-zinc-900">{auditLogs.length}</div>
                <div className="mt-1 text-sm text-zinc-500">Dùng để truy vết thao tác quan trọng.</div>
              </div>
              <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white p-4">
                <div className="text-sm font-bold text-zinc-500">NCC / Đơn nhập</div>
                <div className="mt-2 text-2xl font-black text-zinc-900">{supplierRows.length} / {purchaseRows.length}</div>
                <div className="mt-1 text-sm text-zinc-500">Dữ liệu đã có bảng, chờ màn quản lý sâu.</div>
              </div>
            </div>

            {readiness && (
              <div className="rounded-[var(--radius-card)] border border-zinc-200 overflow-hidden">
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

            <AuditLogSection logs={auditLogs} users={users} />

            <div className="grid gap-4 xl:grid-cols-2">
              <MiniOpsList title="Nhà cung cấp" rows={supplierRows} primaryKey="name" secondaryKey="phone" dateKey="created_at" />
              <MiniOpsList title="Đơn nhập" rows={purchaseRows} primaryKey="code" secondaryKey="status" dateKey="purchase_date" />
            </div>

            <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/60 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-base font-black text-red-700">Clear lịch sử</div>
                  <div className="mt-1 text-sm text-red-700/80">Chỉ admin dùng khi cần dọn dữ liệu giao dịch cũ. Dữ liệu danh mục như khách hàng, hàng hóa, kho vẫn được giữ.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                  onClick={() => setClearHistoryGroups(historyClearOptions.map((item) => item.key))}
                >
                  Chọn tất cả
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {historyClearOptions.map((option) => (
                  <label key={option.key} className="flex cursor-pointer gap-3 rounded-[var(--radius-card)] border border-red-100 bg-white p-3 shadow-sm">
                    <input
                      type="checkbox"
                      checked={clearHistoryGroups.includes(option.key)}
                      onChange={() => toggleClearHistoryGroup(option.key)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-zinc-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-5 rounded-[var(--radius-card)] border-2 border-dashed border-red-300 bg-red-50 p-3 sm:p-4">
                <div className="text-sm font-black uppercase tracking-wide text-red-700">Xóa dữ liệu danh mục — cực kỳ nguy hiểm</div>
                <div className="mt-1 text-xs text-red-700/80">
                  Xóa trắng khách hàng / nhà cung cấp / sản phẩm để làm lại từ đầu. Phải xóa sạch lịch sử liên quan trước (hoặc tick chọn cùng lúc với các nhóm lịch sử ở trên). Có xác nhận 2 lần trước khi xóa; dữ liệu vẫn được lưu vào bản backup JSON bên dưới.
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {masterClearOptions.map((option) => (
                    <label key={option.key} className="flex cursor-pointer gap-3 rounded-[var(--radius-card)] border border-red-200 bg-white p-3 shadow-sm">
                      <input
                        type="checkbox"
                        checked={clearHistoryGroups.includes(option.key)}
                        onChange={() => toggleClearHistoryGroup(option.key)}
                        className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-bold text-red-700">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <Input
                  value={clearHistoryConfirmation}
                  onChange={(event) => setClearHistoryConfirmation(event.target.value)}
                  placeholder="Nhập XOA để xác nhận"
                />
                <Button
                  type="button"
                  onClick={clearSelectedHistory}
                  disabled={isClearingHistory || clearHistoryGroups.length === 0}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isClearingHistory ? "Đang xóa..." : "Xóa lịch sử đã chọn"}
                </Button>
              </div>

              {clearHistoryResult && (
                <div className="mt-4 rounded-[var(--radius-control)] border border-red-100 bg-white p-3 text-sm">
                  <div className="font-bold text-zinc-900">Kết quả xóa</div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(clearHistoryResult).map(([table, count]) => (
                      <div key={table} className="flex justify-between gap-3 rounded bg-zinc-50 px-3 py-2">
                        <span className="truncate text-zinc-500">{table}</span>
                        <span className="font-bold text-zinc-900">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {historyArchives.length > 0 && (
                <div className="mt-4 rounded-[var(--radius-control)] border border-zinc-200 bg-white p-3 text-sm">
                  <div className="font-bold text-zinc-900">Bản lưu tự động trước khi xóa</div>
                  <div className="mt-1 text-xs text-zinc-500">Mỗi lần xóa lịch sử, hệ thống tự lưu toàn bộ dữ liệu bị xóa. Tải JSON để lưu trữ ngoài.</div>
                  <div className="mt-2 space-y-2">
                    {historyArchives.slice(0, 6).map((archive) => {
                      const totalRows = Object.values(archive.row_counts ?? {}).reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
                      return (
                        <div key={archive.id} className="flex flex-col gap-2 rounded bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-900">{new Date(archive.created_at).toLocaleString("vi-VN")}</span>
                            <span className="ml-2 text-xs text-zinc-500">{(archive.groups ?? []).join(", ")} · {totalRows.toLocaleString()} dòng</span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={downloadingArchiveId === archive.id}
                            onClick={() => void downloadHistoryArchive(archive.id)}
                          >
                            {downloadingArchiveId === archive.id ? "Đang tải..." : "Tải JSON"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>}

        {activeSection === "appearance" && <ThemeSettingsSection />}

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
    <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white overflow-hidden">
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

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo mới",
  UPSERT: "Tạo/Cập nhật",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  DISCONTINUE: "Ngưng bán",
  CANCEL: "Hủy",
  CLEAR_HISTORY: "Xóa lịch sử",
  CLEAR_CANCELLED_ORDERS: "Dọn đơn hủy",
  APPROVE: "Duyệt",
  REJECT: "Từ chối",
  ADJUST: "Điều chỉnh"
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  customer: "Khách hàng",
  supplier: "Nhà cung cấp",
  product: "Sản phẩm",
  sales_order: "Đơn bán",
  receipt: "Phiếu thu",
  supplier_payment: "Chi trả NCC",
  payment_promise: "Hẹn trả nợ",
  operations: "Vận hành",
  cashbook_entry: "Sổ quỹ",
  inventory: "Kho",
  inventory_receipt: "Phiếu nhập kho",
  inventory_adjustment: "Điều chỉnh kho",
  user: "Người dùng",
  role: "Phân quyền",
  roles: "Phân quyền",
  customer_debt: "Công nợ KH",
  price_update: "Cập nhật giá",
  import: "Import dữ liệu"
};

function summarizeAudit(log: any): string {
  const after = log.after_json;
  if (!after || typeof after !== "object") return String(log.entity_id ?? "");
  if (after.code || after.name || after.product_name) {
    return [after.code, after.name ?? after.product_name].filter(Boolean).join(" — ");
  }
  if (after.deleted && typeof after.deleted === "object") {
    const total = Object.values(after.deleted).reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
    return `Xóa ${total.toLocaleString("vi-VN")} dòng (${(after.groups ?? []).join(", ")})`;
  }
  if (after.deletedOrders !== undefined) return `Xóa vĩnh viễn ${after.deletedOrders} đơn đã hủy`;
  if (after.promise) return `${Number(after.promise.promised_amount ?? 0).toLocaleString("vi-VN")} đ — hẹn ${after.promise.promised_date ?? ""}`;
  if (after.payment?.amount !== undefined) return `${Number(after.payment.amount).toLocaleString("vi-VN")} đ`;
  if (after.status) return `Trạng thái: ${after.status}`;
  const text = JSON.stringify(after);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function AuditLogSection({ logs, users }: { logs: any[]; users: AdminUser[] }) {
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const nameById = new Map(users.map((user) => [user.id, user.full_name || user.email]));
  const actorName = (id: string) => nameById.get(id) ?? (id ? `${id.slice(0, 8)}…` : "Hệ thống");
  const actionOptions = Array.from(new Set(logs.map((log) => String(log.action ?? "")))).filter(Boolean).sort();
  const actorOptions = Array.from(new Set(logs.map((log) => String(log.actor_id ?? "")))).filter(Boolean);

  const filtered = logs.filter((log) =>
    (!actorFilter || log.actor_id === actorFilter) &&
    (!actionFilter || log.action === actionFilter) &&
    (!search || `${log.entity_type} ${log.entity_id} ${JSON.stringify(log.after_json ?? "")}`.toLowerCase().includes(search.toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div className="font-bold text-zinc-900">Nhật ký hoạt động người dùng</div>
        <div className="mt-0.5 text-xs text-zinc-500">Ai đã làm gì trên hệ thống: tạo/sửa/xóa, thu chi, duyệt kho, xóa lịch sử... ({logs.length} bản ghi gần nhất)</div>
      </div>
      <div className="flex flex-col gap-2 border-b border-zinc-100 p-3 sm:flex-row">
        <select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(1); }} className="h-10 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm sm:w-48">
          <option value="">Tất cả người dùng</option>
          {actorOptions.map((id) => <option key={id} value={id}>{actorName(id)}</option>)}
        </select>
        <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }} className="h-10 rounded-[var(--radius-control)] border border-zinc-200 bg-white px-2 text-sm sm:w-44">
          <option value="">Tất cả hành động</option>
          {actionOptions.map((action) => <option key={action} value={action}>{AUDIT_ACTION_LABELS[action] ?? action}</option>)}
        </select>
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo đối tượng, nội dung..." className="flex-1" />
      </div>

      <div className="hidden md:block max-h-[420px] overflow-auto custom-scrollbar">
        <table className="w-full min-w-[760px] divide-y divide-zinc-100 text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Thời gian</th>
              <th className="px-4 py-2.5">Người dùng</th>
              <th className="px-4 py-2.5">Hành động</th>
              <th className="px-4 py-2.5">Đối tượng</th>
              <th className="px-4 py-2.5">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paged.map((log, index) => (
              <tr key={log.id ?? index} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500">{log.created_at ? new Date(log.created_at).toLocaleString("vi-VN") : "-"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-bold text-zinc-900">{actorName(String(log.actor_id ?? ""))}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{AUDIT_ACTION_LABELS[String(log.action)] ?? log.action}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-zinc-700">{AUDIT_ENTITY_LABELS[String(log.entity_type)] ?? log.entity_type}</td>
                <td className="max-w-[280px] truncate px-4 py-2.5 text-zinc-500" title={summarizeAudit(log)}>{summarizeAudit(log)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Không có bản ghi phù hợp.</div>}
      </div>

      <div className="md:hidden divide-y divide-zinc-100">
        {paged.map((log, index) => (
          <div key={log.id ?? index} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-zinc-900">{actorName(String(log.actor_id ?? ""))}</span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{AUDIT_ACTION_LABELS[String(log.action)] ?? log.action}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-700">{AUDIT_ENTITY_LABELS[String(log.entity_type)] ?? log.entity_type}</div>
            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{summarizeAudit(log)}</div>
            <div className="mt-1 text-xs font-medium text-zinc-400">{log.created_at ? new Date(log.created_at).toLocaleString("vi-VN") : ""}</div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Không có bản ghi phù hợp.</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100 p-3 text-sm">
          <span className="text-zinc-500">Trang {currentPage}/{totalPages} · {filtered.length} bản ghi</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau</Button>
          </div>
        </div>
      )}
    </div>
  );
}
