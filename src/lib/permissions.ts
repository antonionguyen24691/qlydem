type UserLike = {
  role?: string;
  permissions?: Record<string, "none" | "own" | "department" | "all">;
};

export function hasUserPermission(user: UserLike | undefined, permission: string) {
  const configured = user?.permissions?.[permission] ?? user?.permissions?.["*"];
  return configured ? configured !== "none" : undefined;
}

export function userRole(user?: UserLike) {
  return (user?.role ?? "").toUpperCase();
}

export function isAdmin(user?: UserLike) {
  return userRole(user) === "ADMIN";
}

export function canManageProducts(user?: UserLike) {
  return hasUserPermission(user, "products.manage") ?? ["ADMIN", "WAREHOUSE"].includes(userRole(user));
}

export function canEditSalePrices(user?: UserLike) {
  return hasUserPermission(user, "orders.price_override") ?? ["ADMIN", "ACCOUNTANT"].includes(userRole(user));
}

export function canManageInventory(user?: UserLike) {
  return hasUserPermission(user, "inventory.manage") ?? ["ADMIN", "WAREHOUSE"].includes(userRole(user));
}

export function canCountInventory(user?: UserLike) {
  return hasUserPermission(user, "inventory.manage") ?? ["ADMIN", "WAREHOUSE", "ACCOUNTANT"].includes(userRole(user));
}

export function canRequestStockOut(user?: UserLike) {
  return hasUserPermission(user, "inventory.view") ?? ["ADMIN", "WAREHOUSE", "SALE"].includes(userRole(user));
}

export function canSell(user?: UserLike) {
  return hasUserPermission(user, "pos.use") ?? ["ADMIN", "ACCOUNTANT", "SALE"].includes(userRole(user));
}

export function canReturnOrders(user?: UserLike) {
  return hasUserPermission(user, "orders.return") ?? ["ADMIN", "ACCOUNTANT"].includes(userRole(user));
}

export function canViewFinance(user?: UserLike) {
  return hasUserPermission(user, "finance.view") ?? ["ADMIN", "ACCOUNTANT"].includes(userRole(user));
}

export function canViewCustomers(user?: UserLike) {
  return hasUserPermission(user, "customers.view") ?? ["ADMIN", "ACCOUNTANT", "SALE"].includes(userRole(user));
}

export function canViewSuppliers(user?: UserLike) {
  return hasUserPermission(user, "inventory.view") ?? ["ADMIN", "ACCOUNTANT", "WAREHOUSE"].includes(userRole(user));
}
