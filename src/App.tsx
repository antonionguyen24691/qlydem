/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";
import { Inventory } from "./pages/Inventory";
import { Customers } from "./pages/Customers";
import { Finance } from "./pages/Finance";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="finance" element={<Finance />} />
          <Route path="settings" element={<PlaceholderPage title="Cấu hình hệ thống" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

