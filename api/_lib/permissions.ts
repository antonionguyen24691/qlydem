export const PERMISSION_SCOPES = ["none", "own", "department", "all"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];
export type PermissionMap = Record<string, PermissionScope>;

export const PERMISSION_CATALOG = [
  { key: "dashboard.view", label: "Xem tổng quan" },
  { key: "pos.use", label: "Bán hàng POS" },
  { key: "orders.view", label: "Xem đơn hàng" },
  { key: "orders.create", label: "Tạo đơn hàng" },
  { key: "orders.price_override", label: "Sửa giá bán" },
  { key: "orders.cancel", label: "Hủy đơn đã ghi nhận" },
  { key: "price.update.apply", label: "Duyệt áp dụng bảng giá" },
  { key: "customers.view", label: "Xem khách hàng" },
  { key: "customers.create", label: "Tạo khách hàng" },
  { key: "customers.update", label: "Sửa khách hàng" },
  { key: "products.view", label: "Xem hàng hóa" },
  { key: "products.manage", label: "Quản lý hàng hóa" },
  { key: "inventory.view", label: "Xem tồn kho" },
  { key: "inventory.manage", label: "Nhập/xuất/kiểm kho" },
  { key: "finance.view", label: "Xem tài chính/công nợ" },
  { key: "finance.receipt.create", label: "Lập phiếu thu" },
  { key: "finance.expense.create", label: "Ghi chi phí" },
  { key: "finance.fund.manage", label: "Chuyển/rút/điều chỉnh quỹ" },
  { key: "finance.fund.adjust", label: "Điều chỉnh số dư quỹ" },
  { key: "finance.export", label: "Xuất báo cáo" },
  { key: "settings.manage", label: "Cấu hình hệ thống" },
  { key: "users.manage", label: "Quản lý người dùng/quyền" },
  { key: "data.import", label: "Import dữ liệu" },
  { key: "history.clear", label: "Xóa lịch sử" },
  { key: "inventory.count.apply", label: "Áp dụng kết quả kiểm kho" },
  { key: "audit.clear", label: "Xóa nhật ký hoạt động" }
] as const;

const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionMap> = {
  ADMIN: { "*": "all" },
  ACCOUNTANT: {
    "dashboard.view": "all", "pos.use": "all", "orders.view": "all", "orders.create": "all", "orders.price_override": "all", "orders.cancel": "all",
    "customers.view": "all", "customers.create": "all", "customers.update": "all", "products.view": "all",
    "inventory.view": "all", "finance.view": "all", "finance.receipt.create": "all", "finance.expense.create": "all",
    "finance.fund.manage": "all", "finance.export": "all"
  },
  SALE: {
    "dashboard.view": "own", "pos.use": "own", "orders.view": "own", "orders.create": "own",
    "customers.view": "own", "customers.create": "own", "customers.update": "own", "products.view": "all", "inventory.view": "all"
  },
  WAREHOUSE: {
    "dashboard.view": "own", "products.view": "all", "products.manage": "all", "inventory.view": "all", "inventory.manage": "all", "inventory.count.apply": "all"
  },
  VIEWER: { "dashboard.view": "all" }
};

function isScope(value: unknown): value is PermissionScope {
  return typeof value === "string" && PERMISSION_SCOPES.includes(value as PermissionScope);
}

export function normalizePermissions(role: string, raw: unknown): PermissionMap {
  const fallback = { ...(DEFAULT_ROLE_PERMISSIONS[role.toUpperCase()] ?? {}) };
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  if (value.all === true) return { "*": "all" };
  const configured = value.permissions;
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) return fallback;

  const next: PermissionMap = {};
  for (const [key, scope] of Object.entries(configured as Record<string, unknown>)) {
    if (isScope(scope)) next[key] = scope;
  }
  return { ...fallback, ...next };
}

export function permissionScope(permissions: PermissionMap | undefined, permission: string): PermissionScope {
  return permissions?.[permission] ?? permissions?.["*"] ?? "none";
}

export function hasPermission(permissions: PermissionMap | undefined, permission: string) {
  return permissionScope(permissions, permission) !== "none";
}
