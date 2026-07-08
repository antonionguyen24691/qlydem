/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";
import { Inventory } from "./pages/Inventory";
import { Customers } from "./pages/Customers";
import { Finance } from "./pages/Finance";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { useBrandingStore } from "./store/branding";
import { useAuthStore } from "./store/auth";
import { canManageInventory, canSell, canViewCustomers, canViewFinance, isAdmin } from "./lib/permissions";

function RequirePermission({ allow, children }: { allow: (user: any) => boolean; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!allow(user)) return <Navigate to={canSell(user) ? "/pos" : "/"} replace />;
  return <>{children}</>;
}

export default function App() {
  const loadBranding = useBrandingStore((state) => state.loadBranding);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<RequirePermission allow={canSell}><POS /></RequirePermission>} />
          <Route path="orders" element={<RequirePermission allow={canSell}><Orders /></RequirePermission>} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<RequirePermission allow={(user) => canManageInventory(user) || user?.role === "SALE"}><Inventory /></RequirePermission>} />
          <Route path="customers" element={<RequirePermission allow={canViewCustomers}><Customers /></RequirePermission>} />
          <Route path="finance" element={<RequirePermission allow={canViewFinance}><Finance /></RequirePermission>} />
          <Route path="settings" element={<RequirePermission allow={isAdmin}><Settings /></RequirePermission>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
