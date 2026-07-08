type UserLike = {
  role?: string;
};

export function userRole(user?: UserLike) {
  return (user?.role ?? "").toUpperCase();
}

export function isAdmin(user?: UserLike) {
  return userRole(user) === "ADMIN";
}

export function canManageProducts(user?: UserLike) {
  return ["ADMIN", "WAREHOUSE"].includes(userRole(user));
}

export function canManageInventory(user?: UserLike) {
  return ["ADMIN", "WAREHOUSE"].includes(userRole(user));
}

export function canRequestStockOut(user?: UserLike) {
  return ["ADMIN", "WAREHOUSE", "SALE"].includes(userRole(user));
}

export function canSell(user?: UserLike) {
  return ["ADMIN", "ACCOUNTANT", "SALE"].includes(userRole(user));
}

export function canViewFinance(user?: UserLike) {
  return ["ADMIN", "ACCOUNTANT"].includes(userRole(user));
}

export function canViewCustomers(user?: UserLike) {
  return ["ADMIN", "ACCOUNTANT", "SALE"].includes(userRole(user));
}
