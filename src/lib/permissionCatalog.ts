export const permissionScopes = ["none", "own", "department", "all"] as const;
export type PermissionScope = (typeof permissionScopes)[number];

export const permissionScopeLabels: Record<PermissionScope, string> = {
  none: "Không có",
  own: "Của mình",
  department: "Bộ phận",
  all: "Toàn bộ"
};

export const permissionCatalog = [
  { key: "dashboard.view", label: "Xem tổng quan" },
  { key: "pos.use", label: "Bán hàng POS" },
  { key: "orders.view", label: "Xem đơn hàng" },
  { key: "orders.create", label: "Tạo đơn hàng" },
  { key: "orders.price_override", label: "Chiết khấu giá" },
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
  { key: "finance.export", label: "Xuất báo cáo" },
  { key: "settings.manage", label: "Cấu hình hệ thống" },
  { key: "users.manage", label: "Quản lý user/quyền" },
  { key: "data.import", label: "Import dữ liệu" },
  { key: "history.clear", label: "Xóa lịch sử" }
] as const;

const defaultRolePermissions: Record<string, Record<string, PermissionScope>> = {
  ADMIN: { "*": "all" },
  ACCOUNTANT: {
    "dashboard.view": "all", "pos.use": "all", "orders.view": "all", "orders.create": "all", "orders.price_override": "all",
    "customers.view": "all", "customers.create": "all", "customers.update": "all", "products.view": "all",
    "inventory.view": "all", "finance.view": "all", "finance.receipt.create": "all", "finance.expense.create": "all",
    "finance.fund.manage": "all", "finance.export": "all"
  },
  SALE: {
    "dashboard.view": "own", "pos.use": "own", "orders.view": "own", "orders.create": "own",
    "customers.view": "own", "customers.create": "own", "customers.update": "own", "products.view": "all", "inventory.view": "all"
  },
  WAREHOUSE: {
    "dashboard.view": "own", "products.view": "all", "products.manage": "all", "inventory.view": "all", "inventory.manage": "all"
  },
  VIEWER: { "dashboard.view": "all" }
};

export function permissionScopeFor(role: string, permissionsJson: Record<string, unknown>, permission: string): PermissionScope {
  if (permissionsJson.all === true || permissionsJson["*"] === "all") return "all";
  const configured = permissionsJson.permissions;
  if (configured && typeof configured === "object" && !Array.isArray(configured)) {
    const value = (configured as Record<string, unknown>)[permission];
    if (permissionScopes.includes(value as PermissionScope)) return value as PermissionScope;
  }
  return defaultRolePermissions[role.toUpperCase()]?.[permission] ?? "none";
}

export function withPermissionScope(permissionsJson: Record<string, unknown>, permission: string, scope: PermissionScope) {
  const current = permissionsJson.permissions;
  const permissions = current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return { permissions: { ...permissions, [permission]: scope } };
}
