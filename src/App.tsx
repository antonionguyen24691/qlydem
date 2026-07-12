/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { useBrandingStore } from "./store/branding";
import { useAuthStore } from "./store/auth";
import { canManageInventory, canSell, canViewCustomers, canViewFinance, canViewSuppliers, isAdmin } from "./lib/permissions";
import { PwaInstallPrompt } from "./features/pwa/PwaInstallPrompt";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const POS = lazy(() => import("./pages/POS").then((module) => ({ default: module.POS })));
const Orders = lazy(() => import("./pages/Orders").then((module) => ({ default: module.Orders })));
const Bill = lazy(() => import("./pages/Bill").then((module) => ({ default: module.Bill })));
const Products = lazy(() => import("./pages/Products").then((module) => ({ default: module.Products })));
const Inventory = lazy(() => import("./pages/Inventory").then((module) => ({ default: module.Inventory })));
const Customers = lazy(() => import("./pages/Customers").then((module) => ({ default: module.Customers })));
const Suppliers = lazy(() => import("./pages/Suppliers").then((module) => ({ default: module.Suppliers })));
const Finance = lazy(() => import("./pages/Finance").then((module) => ({ default: module.Finance })));
const Expenses = lazy(() => import("./pages/Expenses").then((module) => ({ default: module.Expenses })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));

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
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Đang tải...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<RequirePermission allow={canSell}><POS /></RequirePermission>} />
            <Route path="orders/:orderId/bill" element={<RequirePermission allow={canSell}><Bill /></RequirePermission>} />
            <Route path="orders" element={<RequirePermission allow={canSell}><Orders /></RequirePermission>} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<RequirePermission allow={(user) => canManageInventory(user) || user?.role === "SALE"}><Inventory /></RequirePermission>} />
            <Route path="customers" element={<RequirePermission allow={canViewCustomers}><Customers /></RequirePermission>} />
            <Route path="suppliers" element={<RequirePermission allow={canViewSuppliers}><Suppliers /></RequirePermission>} />
            <Route path="finance" element={<RequirePermission allow={canViewFinance}><Finance /></RequirePermission>} />
            <Route path="expenses" element={<RequirePermission allow={canViewFinance}><Expenses /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission allow={isAdmin}><Settings /></RequirePermission>} />
          </Route>
        </Routes>
      </Suspense>
      <PwaInstallPrompt />
    </BrowserRouter>
  );
}
