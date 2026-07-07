# SOFTWARE DESIGN DOCUMENT (SDD)
## HỆ THỐNG ERP BÁN HÀNG VẬT LIỆU XÂY DỰNG

---

## 1. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

**Mô hình tổng quan:**
- **Frontend (Client-side):** SPA (Single Page Application) sử dụng React.js (Vite) + Tailwind CSS + shadcn/ui.
- **Backend (Server-side):** Node.js (Express) để xử lý API trung gian, chứng thực, cache và tương tác với Database.
- **Database (Data Layer):** Google Sheets API (sử dụng như Database chính theo yêu cầu).
- **Authentication & Authorization:** Firebase Authentication + JWT. Phân quyền Role-based Access Control (RBAC).
- **AI Integration:** Google Gemini API cho tính năng Chatbot tư vấn, trích xuất thông tin, hỗ trợ sale.
- **External Services:** Google Drive (lưu trữ file/hình ảnh), Gmail (gửi email hóa đơn, báo cáo).

**Luồng dữ liệu (Data Flow):**
1. Người dùng thao tác trên giao diện (Frontend).
2. Frontend gọi API nội bộ (Backend - Node.js) kèm theo JWT Token.
3. Backend xác thực JWT thông qua Firebase Admin SDK.
4. Backend xử lý Business Logic.
5. Backend gọi Google Sheets API thông qua Service Account hoặc OAuth token để Đọc/Ghi dữ liệu (Dữ liệu được chuẩn hóa Relational).
6. Kết quả trả về Backend -> format lại JSON trả về Frontend.

---

## 2. DATABASE SCHEMA (GOOGLE SHEETS)

Mỗi "Bảng" dưới đây tương ứng với một Sheet trong Google Sheets. Hàng đầu tiên (Row 1) là Header (Tên cột).

**1. Users (Tài khoản & Phân quyền)**
- `Id` (PK - UUID)
- `Email` (Unique)
- `FullName`
- `RoleId` (FK -> Roles)
- `Status` (Active/Inactive)
- `CreatedAt`, `UpdatedAt`

**2. Roles & Permissions (Quyền hạn)**
- `RoleId` (PK) | `RoleName` (ADMIN, ACCOUNTANT, SALE)
- (Bảng Permissions cấu hình cứng trong code hoặc lưu JSON trong một cột của Role)

**3. Customers (Khách hàng)**
- `CustomerId` (PK)
- `CustomerCode` (Mã KH - Unique)
- `Name`, `Phone`, `Address`, `Email`, `TaxCode`, `ContactPerson`
- `CustomerGroupId` (FK)
- `AssignedSaleId` (FK -> Users)
- `CreditLimit` (Hạn mức nợ)
- `CreditDays` (Số ngày nợ tối đa)
- `CreatedAt`, `UpdatedAt`

**4. Suppliers (Nhà cung cấp)**
- `SupplierId` (PK)
- `SupplierCode` (Unique)
- `Name`, `Phone`, `Address`, `TaxCode`, `ContactPerson`
- `CreatedAt`, `UpdatedAt`

**5. Products (Hàng hóa)**
- `ProductId` (PK)
- `ProductCode` (Unique)
- `Barcode`, `QRCode`
- `ProductName`, `InvoiceName`
- `CategoryId` (FK -> Categories)
- `Dimensions` (Kích thước)
- `Unit` (Đơn vị tính: hộp, viên, m2)
- `SquareMetersPerBox` (m2/hộp)
- `PiecesPerBox` (Viên/hộp)
- `CostPrice` (Giá vốn)
- `SellPrice` (Giá bán)
- `VatRate` (VAT)
- `ImageUrl` (Google Drive Link)
- `Status` (Active/Inactive)
- `CreatedAt`, `UpdatedAt`

**6. Categories (Danh mục)**
- `CategoryId` (PK)
- `CategoryName`

**7. Warehouses (Kho hàng)**
- `WarehouseId` (PK)
- `WarehouseName`, `Address`

**8. Inventory (Tồn kho)**
- `InventoryId` (PK)
- `WarehouseId` (FK)
- `ProductId` (FK)
- `Quantity`
- `MinStockLevel` (Cảnh báo tồn)

**9. SalesOrders (Đơn bán hàng)**
- `OrderId` (PK)
- `OrderCode` (Unique)
- `CustomerId` (FK)
- `SaleId` (FK -> Users)
- `OrderDate`
- `SubTotal`, `Discount`, `VatAmount`, `TotalAmount`
- `PaymentMethod` (CASH, BANK, DEBT)
- `Status` (DRAFT, COMPLETED, CANCELLED)
- `Notes`
- `CreatedAt`, `UpdatedAt`

**10. SalesOrderItems (Chi tiết Đơn bán)**
- `OrderItemId` (PK)
- `OrderId` (FK)
- `ProductId` (FK)
- `Quantity`
- `UnitPrice`, `DiscountAmount`, `VatRate`, `TotalLineAmount`

**11. PurchaseOrders (Đơn nhập hàng)**
- `PurchaseId` (PK)
- `PurchaseCode` (Unique)
- `SupplierId` (FK)
- `PurchaseDate`
- `TotalAmount`
- `Status`
- `CreatedAt`, `UpdatedAt`

**12. PurchaseOrderItems (Chi tiết Nhập hàng)**
- (Tương tự SalesOrderItems nhưng trỏ về PurchaseId)

**13. Receipts (Phiếu Thu - Khách hàng thanh toán)**
- `ReceiptId` (PK)
- `ReceiptCode`
- `CustomerId` (FK)
- `OrderId` (FK - Optional, nếu thu theo hóa đơn)
- `Amount`
- `PaymentMethod`, `ReceiptDate`, `Notes`
- `CreatedBy` (FK -> Users)

**14. Payments (Phiếu Chi - Thanh toán NCC)**
- `PaymentId` (PK)
- `SupplierId` (FK)
- `PurchaseId` (FK - Optional)
- `Amount`, `PaymentDate`, `Notes`

**15. Debt (Công nợ tổng hợp hiện tại)**
- `EntityId` (FK -> CustomerId hoặc SupplierId)
- `EntityType` (CUSTOMER / SUPPLIER)
- `TotalDebt`

**16. DebtHistory (Lịch sử biến động công nợ)**
- `HistoryId` (PK)
- `EntityId` (FK)
- `EntityType` (CUSTOMER / SUPPLIER)
- `TransactionId` (FK -> OrderId, PurchaseId, ReceiptId, PaymentId)
- `TransactionType` (INVOICE, RECEIPT, BILL, PAYMENT)
- `AmountChange` (+/-)
- `BalanceAfter`
- `Date`

**17. InventoryTransactions (Lịch sử kho)**
- `TransId` (PK)
- `WarehouseId` (FK)
- `ProductId` (FK)
- `TransType` (IN, OUT, TRANSFER, ADJUST)
- `ReferenceId` (FK -> OrderId, PurchaseId...)
- `QuantityChange` (+/-)
- `StockAfter`
- `Date`

**18. Settings (Cấu hình hệ thống)**
- `Key`, `Value`

**19. AuditLogs (Nhật ký hệ thống)**
- `LogId` (PK)
- `UserId` (FK)
- `Action` (CREATE, UPDATE, DELETE)
- `TableName`
- `RecordId`
- `OldValue` (JSON), `NewValue` (JSON)
- `Timestamp`

---

## 3. ERD (Entity Relationship Diagram - Mô tả logic)

- **Users** (1) -> (N) **Customers** (AssignedSale)
- **Users** (1) -> (N) **SalesOrders** (CreatedBy)
- **Customers** (1) -> (N) **SalesOrders**
- **Suppliers** (1) -> (N) **PurchaseOrders**
- **SalesOrders** (1) -> (N) **SalesOrderItems**
- **PurchaseOrders** (1) -> (N) **PurchaseOrderItems**
- **Products** (1) -> (N) **SalesOrderItems** / **PurchaseOrderItems** / **Inventory**
- **Warehouses** (1) -> (N) **Inventory**
- Các giao dịch (Đơn hàng, Phiếu thu/chi) sẽ trigger việc ghi dữ liệu vào các bảng **DebtHistory** và **InventoryTransactions** để đảm bảo tính toàn vẹn (Event Sourcing pattern áp dụng cho Google Sheets).

---

## 4. USER FLOW (Luồng người dùng chính)

**A. Luồng Bán hàng (Sales Flow) - Dành cho SALE:**
1. Login -> Dashboard (thấy doanh số cá nhân, KPI).
2. Click "Tạo đơn hàng mới" (hoặc dùng phím tắt).
3. Tìm khách hàng (Autocomplete) hoặc Thêm mới nhanh.
4. Quét Barcode/QR hoặc Gõ tên sản phẩm -> Chọn vào giỏ hàng.
5. Cập nhật số lượng (hệ thống tự quy đổi hộp/viên/m2). Hệ thống báo tồn kho realtime.
6. Áp dụng Chiết khấu, check VAT (nếu có).
7. Chọn hình thức thanh toán (Tiền mặt, Chuyển khoản, Công nợ).
8. Nếu chọn Công nợ -> Hệ thống check `CreditLimit` (Hạn mức nợ).
9. Hoàn tất -> Lưu Đơn hàng -> In PDF / Gửi Gmail cho KH.

**B. Luồng Kế toán (Accounting Flow):**
1. Login -> Xem Dashboard tổng hợp (Công nợ, dòng tiền).
2. Vào màn hình Đơn hàng -> Xem các đơn SALE đã lập.
3. Nhận chuyển khoản -> Lập phiếu thu (Receipt). Hệ thống tự giảm công nợ khách hàng.
4. Cuối ngày -> Màn hình Khóa sổ -> Chốt doanh thu, tồn kho ngày. Không ai được sửa dữ liệu trước thời điểm khóa sổ.

---

## 5. SITEMAP (Cấu trúc Menu)

- **/dashboard**: Bảng điều khiển tổng quan (phân quyền hiển thị theo Role).
- **/pos**: Màn hình bán hàng nhanh (Thiết kế tối ưu thao tác).
- **/orders**: Quản lý đơn hàng (Danh sách, Chi tiết).
- **/customers**: Quản lý khách hàng, Nhóm KH, Công nợ KH.
- **/products**: Quản lý hàng hóa, Danh mục.
- **/inventory**:
  - Nhập hàng (Purchase)
  - Quản lý NCC
  - Phiếu xuất/nhập/chuyển/kiểm kê.
- **/finance**:
  - Sổ quỹ (Tiền mặt/Ngân hàng)
  - Công nợ phải thu (Receivables)
  - Công nợ phải trả (Payables)
- **/reports**:
  - Báo cáo doanh thu, lợi nhuận.
  - Báo cáo kho, bán hàng.
- **/settings**: Quản lý User, Cấu hình hệ thống, Nhật ký (Audit Logs).
- **/ai-chat**: Trợ lý ảo Gemini (Phân tích số liệu, hỏi đáp nhanh).

---

## 6. MODULE BREAKDOWN (Chia nhỏ Module)

1. **Auth & Core Module**: Xử lý Login, JWT, Firebase Auth, RBAC Guardian, Layout (Sidebar, Topbar).
2. **POS Module**: Giao diện bán hàng tối ưu cho chuột + phím + máy quét. Giỏ hàng lưu LocalStorage (Draft).
3. **CRM Module**: Quản lý thông tin khách hàng, lịch sử mua, hạn mức tín dụng.
4. **PIM Module (Product Information Management)**: Quản lý danh mục, hàng hóa, quy đổi đơn vị (đặc thù VLXD).
5. **WMS Module (Warehouse Management System)**: Quản lý thẻ kho, nhập/xuất/tồn, định mức cảnh báo.
6. **Accounting Module**: Thu/Chi, Công nợ, Khóa sổ, Báo cáo tài chính.
7. **Google Workspace Sync**: Wrapper cho G-Sheets (ORM layer), Drive (Upload ảnh), Gmail (Send bill).

---

## 7. API DESIGN (RESTful + DTOs)

*Vì database là Google Sheets, API sẽ được build trên Node.js để che giấu logic đọc/ghi Sheets.*

- `POST /api/auth/login`: Trả về JWT Token.
- `GET /api/products`: Search, pagination, filter.
- `GET /api/products/search?q={query}`: Tối ưu autocomplete.
- `POST /api/orders`: Tạo đơn hàng mới. (Transaction: Thêm Order, Thêm OrderItems, Trừ Inventory, Ghi Debt).
- `GET /api/orders/:id`: Lấy chi tiết đơn.
- `POST /api/customers`: Thêm KH mới.
- `GET /api/reports/dashboard`: Lấy metrics tổng hợp cho biểu đồ.
- `POST /api/ai/chat`: Gửi query cho Gemini API, kèm context (ví dụ: "Doanh thu hôm nay bao nhiêu?").

---

## 8. FOLDER STRUCTURE (Vite + React + Node.js)

```text
/
├── server/                     # Backend Node.js
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/        # Auth, Role check
│   │   ├── services/           # Logic giao tiếp Google Sheets API, Gemini API
│   │   ├── routes/
│   │   └── utils/              # Google Sheets ORM Helper
│   ├── server.ts               # Entry point
│   └── package.json
├── src/                        # Frontend React
│   ├── assets/
│   ├── components/             # Reusable UI (shadcn, Buttons, Tables)
│   ├── features/               # Domain logic (auth, pos, inventory...)
│   │   └── pos/
│   │       ├── POSLayout.tsx
│   │       ├── Cart.tsx
│   │       └── ProductScanner.tsx
│   ├── hooks/                  # Custom hooks (useAuth, useCart)
│   ├── layouts/                # MainLayout, Sidebar, Navbar
│   ├── lib/                    # API clients (axios), utils
│   ├── pages/                  # Route components
│   ├── store/                  # Zustand (State management)
│   ├── types/                  # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── vite.config.ts
```

---

## 9. COMPONENT TREE (Frontend)

```
App
 └── AuthProvider
     └── Router
         ├── Login Route
         └── ProtectedRoute
             └── MainLayout
                 ├── Sidebar (Navigation)
                 ├── Topbar (User Menu, Global Search, Notification, Gemini Chat Toggle)
                 └── Page Content
                     ├── DashboardPage
                     ├── POSPage
                     │    ├── CustomerSelect (Autocomplete)
                     │    ├── ProductSearchScanner
                     │    ├── CartTable (Virtual Scroll)
                     │    └── CheckoutPanel (Tính tiền, Thanh toán)
                     ├── ProductListPage
                     │    ├── FilterBar
                     │    └── DataTable (Infinite Table)
                     └── ... (các trang khác)
```

---

## 10. WIREFRAME TỪNG MÀN HÌNH (Mô tả cấu trúc UI)

**10.1. Màn hình POS (Bán hàng) - Tối đa không gian**
- **Top:** Search KH, Nút "Thêm KH nhanh". Thông tin KH (Nợ cũ, Hạn mức).
- **Left/Center (70%):**
  - Ô search sản phẩm / Quét mã vạch (Focus mặc định).
  - Bảng giỏ hàng: STT, Mã, Tên, Đơn vị (Drop-down: Hộp/Viên/m2), Số lượng (Input), Đơn giá, CK, Thành tiền, Nút Xóa.
- **Right (30%):**
  - Khung Thanh toán: Tổng tiền hàng, Giảm giá, VAT.
  - Khách cần trả, Khách thanh toán (Input), Tiền thừa.
  - Phương thức: Nút [Tiền mặt] [Chuyển khoản] [Ghi nợ].
  - Nút Action to: [Lưu nháp], [Thanh toán & In] (Màu xanh #006B68).

**10.2. Màn hình Dashboard**
- Dãy Cards trên cùng: Doanh thu (hôm nay, tháng), Lợi nhuận (ẩn với SALE), Công nợ thu, Tồn kho.
- Biểu đồ Bar (Doanh thu 7 ngày).
- Bảng Top Sản phẩm bán chạy.
- Bảng Cảnh báo tồn kho dưới định mức.

---

## 11. DANH SÁCH TOÀN BỘ CHỨC NĂNG (Feature List)

- **Auth:** Đăng nhập, Quản lý phiên làm việc, Đổi mật khẩu. Phân quyền Admin/Kế toán/Sale.
- **POS:** Bán hàng bằng phím tắt, Quy đổi đơn vị (hộp -> m2 -> viên tự động tính giá), Thanh toán đa phương thức, Lưu nháp đơn, Quản lý giỏ hàng offline tạm thời.
- **Kho:** Cảnh báo tồn định mức tối thiểu, Thẻ kho lịch sử, Điều chỉnh kho.
- **Công nợ:** Báo cáo tuổi nợ, Hạn mức tín dụng KH (chặn xuất hàng nếu vượt nợ), Đối trừ công nợ.
- **In ấn & Xuất:** Xuất PDF Hóa đơn A4/A5/K80, Gửi hóa đơn qua Gmail.
- **AI Chatbot:** Trợ lý Gemini nằm góc màn hình (Floating Widget) hỗ trợ query: "Khách hàng A đang nợ bao nhiêu?", "Sản phẩm gạch Viglacera nào bán chạy nhất tháng này?".
- **Hệ thống:** Global Search (tìm KH, SP, Hóa đơn từ mọi nơi), Khóa sổ cuối ngày, Ghi Log thao tác.

---

## 12. ROADMAP PHÁT TRIỂN (Phân phase triển khai)

- **Phase 1 (MVP - 2 tuần):**
  - Khởi tạo kiến trúc, thiết kế Google Sheets Database.
  - Phân quyền (Firebase Auth).
  - Quản lý Hàng hóa, Khách hàng, NCC.
  - Module Bán hàng (POS cơ bản) và Tồn kho cơ bản.
- **Phase 2 (Hoàn thiện - 2 tuần):**
  - Module Kế toán, Công nợ (Thu/Chi).
  - In PDF, Gửi Gmail hóa đơn.
  - Báo cáo và Dashboard.
  - Upload ảnh lên Google Drive.
- **Phase 3 (Nâng cao & Scale - 1 tuần):**
  - Tích hợp Gemini Chatbot.
  - Tối ưu Caching, Virtual Scroll.
  - Audit Logs, Khóa sổ dữ liệu.
  - Đóng gói chuẩn bị cho việc thay thế Sheet bằng PostgreSQL trong tương lai (Chuẩn hóa Interface ORM).

---

## 13. ĐỀ XUẤT CÔNG NGHỆ (Technology Stack)

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand (State), React Table (TanStack), React Hook Form, Zod.
- **Backend:** Node.js, Express, TypeScript.
- **Database Layer:** Google APIs Node.js Client (cho Google Sheets, Drive, Gmail).
- **Authentication:** Firebase Admin SDK (Backend) & Firebase Auth (Frontend).
- **AI:** `@google/genai` (Gemini 3.1 Pro / Flash).
- **Deployment:** Vercel (Frontend), Render/Cloud Run (Backend).

---

## 14. CÁC ĐIỂM CÓ THỂ MỞ RỘNG SAU NÀY

1. **Chuyển đổi Database:** Do việc đọc/ghi Google Sheets được đóng gói qua 1 Data Access Layer (Repository Pattern) ở Backend Node.js, việc chuyển sang PostgreSQL chỉ cần viết lại các class Repository này, không ảnh hưởng API layer hay Frontend.
2. **SaaS Multi-tenant:** Thêm trường `TenantId` vào mọi bảng để hỗ trợ nhiều công ty/cửa hàng dùng chung 1 hệ thống.
3. **App Mobile:** Xây dựng app React Native tái sử dụng hoàn toàn API của hệ thống này.
4. **Zalo/SMS ZNS:** Tích hợp gửi tin nhắn nhắc nợ khách hàng.

---

## 15. CHECKLIST ĐỂ AI (CODEX/CLAUDE/GEMINI) CÓ THỂ LẬP TRÌNH NGAY

- [ ] 1. Khởi tạo project React + TS.
- [ ] 2. Cài đặt Tailwind CSS v4, shadcn/ui cơ bản (Button, Input, Table, Dialog, Toast).
- [ ] 3. Thiết lập Backend Express, chia thư mục controllers, services.
- [ ] 4. Tạo file Google Sheets Helper (`sheets.ts`) với các hàm CRUD cơ bản (insertRow, getRows, updateRow).
- [ ] 5. Cấu hình Firebase Auth ở cả Frontend & Backend.
- [ ] 6. Tạo các Zustand Stores (`useAuthStore`, `useCartStore`).
- [ ] 7. Xây dựng giao diện POSayout (chia Grid).
- [ ] 8. Triển khai logic tính toán quy đổi đơn vị ở màn hình Bán hàng.
- [ ] 9. Tích hợp Google Workspace API (Drive lưu ảnh SP, Gmail gửi PDF).
- [ ] 10. Tích hợp Gemini API (`@google/genai`) làm chatbot tư vấn nội bộ.
