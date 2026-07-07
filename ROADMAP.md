# ROADMAP HOAN THIEN CRM QLBH

Ngay lap: 2026-07-07  
Nguon nghiep vu goc: `NHAT KY BAN HANG.xlsx`  
App hien tai: React 19 + Vite + Tailwind CSS + Zustand, dang chay bang mock data tren trinh duyet.

## 1. Ket luan sau khi doc app demo

App hien tai la ban demo giao dien POS/ERP cho vat lieu xay dung, da co cac man hinh nen:

- Dashboard tong quan.
- Ban hang POS.
- Nhat ky don hang.
- Danh muc san pham.
- Ton kho.
- Khach hang.
- Tai chinh va cong no.
- Sidebar/mobile overlay, topbar co bell notification UI gia lap.

Nhung app chua phai ban san xuat:

- Du lieu dang nam trong `src/data/mock.ts`, khong doc/ghi tu Excel, Google Sheets hay database.
- Them khach, them san pham, ban hang, thu no chi cap nhat Zustand trong bo nho trinh duyet, reload la mat.
- Chua co login, chua co phan quyen, topbar dang hard-code `Admin User`.
- Chua co backend/API, chua co secret handling, chua san sang dung truc tiep Google Sheets tu client.
- Chua co in bill that, nut in hien moi `alert`.
- Chua co format bill A4/A5/K80, chua co so phieu/tien no/thanh toan theo mau cong ty.
- Chua co dong bo Google Sheets, chua co import/migration tu workbook hien huu.
- Chua co PWA/mobile app chuan, offline draft, push notification, camera barcode.
- Chua co co che audit log, khoa so, chong sua/xoa du lieu nguy hiem.

## 2. Ket qua doc file Excel goc

Workbook `NHAT KY BAN HANG.xlsx` hien co cac nhom du lieu chinh:

- Cac sheet phieu ban theo ngay/khach: `phieu xuat kho chuẩn`, `11.06 (2)`, `20.06`, `18.06`, `21.06`, `22.06 `, `23,06`, `29,6`, `30,6`, `01,07,2026`, `02,07,2026 (2)`, `NHỰT NGA`.
- Sheet cong no: `CONG NO`, gom cac cot `NGÀY`, `BÊN MUA HÀNG`, `SỐ TIỀN BÁN`, `ĐÃ TRẢ`, `CÒN NỢ`, `TỔNG`, `GHI CHÚ`, `SHORT`.
- Sheet khach hang/cua hang: `CỬA HÀNG`, gom STT va ten cua hang.
- Sheet kho hang: `KHO HANG`, gom `Mã hàng`, `Tên trên Hđ`, `Tên vật tư`, `Kích thước`, `M2`, `SỐ V TRONG HỘP`, `GIÁ THEO M2`, `NHAP VAT`, `GIÁ HỘP VAT`.

Diem can luu y:

- Excel dang la workbook van hanh bang mau phieu, khong phai database chuan.
- Cung mot phieu co the co nhieu block thong tin, nhieu cot trong, merge/format va cong thuc khong phu hop doc truc tiep lam API.
- Truoc khi dua len app, can viet buoc import chuan hoa thanh cac bang: Customers, Products, Orders, OrderItems, Receipts, DebtLedger, InventoryTransactions.
- Google Sheets nen la database van hanh moi, con workbook Excel hien huu nen dung lam nguon migration/doi soat.

## 3. Muc tieu san pham

Xay CRM QLBH thanh he thong ban hang noi bo dung duoc hang ngay tren desktop va mobile:

- Sale tao don nhanh, tim hang, chon khach, ghi no, in bill.
- Ke toan theo doi cong no, thu tien, doi soat ngay.
- Quan ly xem doanh thu, ton kho, cong no, lich su thao tac.
- Du lieu dung chung qua Google Sheets de de theo doi, backup, chinh sua co kiem soat.
- Deploy tren Vercel, co backend API bao ve secrets va phan quyen.
- Co lo trinh nang cap notification, nhac no, Telegram bot, va mobile app sau nay.

## 3.1 Cac module can bo sung ngoai phase ban dau

Ngoai POS, cong no, notification va Telegram, app nen co them cac lop quan tri sau de tro thanh he thong dung duoc lau dai:

- Settings Center: trung tam cau hinh toan bo he thong cho admin, khong hard-code trong code.
- Customer 360: trang ho so khach hang gom thong tin, so cong no, doanh so, lich su mua, lich su thu tien, hang hay mua, sale phu trach, ghi chu cham soc.
- Supplier 360: trang ho so nha cung cap gom thong tin, cong no phai tra, lich su nhap hang, gia mua, san pham cung cap, lien he, ghi chu.
- So cong no dep va dung chuan ledger: moi bien dong no la mot dong, co so du sau giao dich, loc/doi soat/in/xuat Excel.
- Product lifecycle: trang thai hang hoa, tam ngung ban, het hang, sap het, hang moi, hang cham ban, ngung kinh doanh, hang can kiem kho.
- Pricing Center: cau hinh bang gia ban le/ban buon/gia theo nhom khach/gia theo sale/chiet khau.
- Purchase & Supplier module: lap don nhap, nhan hang, thanh toan nha cung cap, cong no phai tra.
- Approval workflow: duyet sua/xoa don, duyet vuot han muc cong no, duyet giam gia sau nguong.
- Data quality center: phat hien trung khach, trung ma hang, thieu SDT, sai dinh dang tien/ngay, du lieu import loi.
- Report Builder don gian: admin chon cot, bo loc, xuat Excel/PDF cho cac bao cao hay dung.
- Activity timeline: moi khach/NCC/don/hang co lich su thao tac de truy vet.
- Attachment center: dinh kem anh bill, bien nhan chuyen khoan, hinh san pham, file doi soat.
- Cashbook & bankbook: so quy tien mat, so ngan hang, doi soat voi phieu thu/chi.
- Returns/adjustments: tra hang, doi hang, huy don, dieu chinh kho/cong no co ly do va audit.
- Backup/restore UI: admin tu tao ban backup, tai ve, va xem lich su backup.

## 3.2 Nguyen tac thiet ke nghiep vu

- Khong chi luu so tong; phai luu lich su phat sinh. Cong no, ton kho, doanh so, thu chi deu tinh duoc lai tu ledger.
- Moi hanh dong quan trong phai co nguoi tao, thoi gian, ly do, trang thai va audit log.
- Man hinh mobile phai la luong lam viec that, khong chi la table desktop thu nho.
- Admin co the cau hinh ma khong can sua code: role, quyen, bill, kho, bang gia, han muc, notification, mau tin nhan.
- Co che "dong so" sau khi khoa so ngay/thang: du lieu cu chi sua bang phieu dieu chinh hoac yeu cau duyet.

## 4. Kien truc de xuat

### 4.1 Frontend

- React + Vite hien tai giu lai, refactor theo feature modules.
- Tailwind CSS giu lai, chuan hoa design token va responsive.
- Zustand chi dung cho UI state/cart draft; du lieu nghiep vu lay qua API.
- Them React Query/TanStack Query de cache, sync, loading/error state.
- Them PWA: manifest, service worker, installable app, offline draft POS.

### 4.2 Backend tren Vercel

- Dung Vercel Serverless Functions hoac Next.js API route neu migrate sang Next.js.
- Khong goi Google Sheets truc tiep tu browser.
- Backend quan ly:
  - Auth token validation.
  - RBAC.
  - Google Sheets CRUD.
  - Business transaction: tao don, tru kho, ghi cong no, ghi audit log.
  - In bill PDF/HTML.
  - Notification jobs.

### 4.3 Data layer

- Phase 1 co the dung Google Sheets lam primary database.
- Can viet repository layer de sau nay chuyen sang PostgreSQL/Supabase khong phai viet lai UI.
- Moi record can co `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `status`.
- Cac giao dich tien/kho/cong no phai ghi ledger, khong chi update so tong.

## 5. Schema Google Sheets can tao moi

Bat buoc tao file Google Sheets moi, khong dung truc tiep workbook Excel cu lam database.

### Core

- `settings`: key, value, updatedAt.
- `users`: id, email, fullName, phone, role, status, saleCode, createdAt.
- `roles`: role, name, permissionsJson.
- `permission_groups`: id, name, description, permissionsJson, createdAt.
- `approval_requests`: id, type, entityType, entityId, requestedBy, reason, status, approvedBy, approvedAt, rejectedReason.
- `audit_logs`: id, actorId, action, entityType, entityId, beforeJson, afterJson, createdAt, ip.

### Master data

- `customers`: id, code, name, shortName, phone, address, taxCode, group, assignedSaleId, creditLimit, creditDays, status, note, lastOrderAt, totalRevenue, currentDebt.
- `suppliers`: id, code, name, shortName, phone, address, taxCode, contactPerson, paymentTerms, status, note, currentPayable.
- `products`: id, code, invoiceName, productName, category, brand, size, unit, m2PerBox, piecesPerBox, priceByM2, sellPriceBoxVat, costPrice, vatRate, barcode, status, lifecycleStatus.
- `product_status_history`: id, productId, oldStatus, newStatus, reason, changedBy, changedAt.
- `price_lists`: id, name, customerGroup, effectiveFrom, effectiveTo, status.
- `price_list_items`: id, priceListId, productId, unitPrice, minQuantity, discountPercent.
- `warehouses`: id, code, name, address, status.
- `inventory_balances`: id, warehouseId, productId, quantityBox, quantityPiece, minStockLevel, updatedAt.

### Transactions

- `sales_orders`: id, code, orderDate, customerId, saleId, subtotal, discountAmount, vatAmount, totalAmount, paidAmount, debtAmount, paymentMethod, status, note, printedAt.
- `sales_order_items`: id, orderId, productId, productCode, productName, unit, quantity, unitPrice, discountAmount, vatRate, lineTotal.
- `purchase_orders`: id, code, purchaseDate, supplierId, warehouseId, subtotal, discountAmount, vatAmount, totalAmount, paidAmount, payableAmount, status, note.
- `purchase_order_items`: id, purchaseId, productId, productCode, productName, unit, quantity, unitCost, lineTotal.
- `receipts`: id, code, customerId, orderId, amount, paymentMethod, receiptDate, note, createdBy.
- `payments`: id, code, supplierId, purchaseId, amount, paymentMethod, paymentDate, note, createdBy.
- `customer_debt_ledger`: id, customerId, sourceType, sourceId, debit, credit, balanceAfter, dueDate, status, note, createdAt.
- `supplier_debt_ledger`: id, supplierId, sourceType, sourceId, debit, credit, balanceAfter, dueDate, status, note, createdAt.
- `inventory_transactions`: id, warehouseId, productId, sourceType, sourceId, quantityChange, stockAfter, note, createdAt.
- `cashbook_entries`: id, code, accountType, direction, sourceType, sourceId, amount, paymentMethod, note, createdAt, createdBy.
- `attachments`: id, entityType, entityId, fileName, fileUrl, mimeType, uploadedBy, uploadedAt.

### Notifications

- `notifications`: id, userId, type, title, body, entityType, entityId, readAt, createdAt.
- `reminder_rules`: id, name, channel, targetRole, conditionJson, scheduleCron, enabled.
- `telegram_subscribers`: id, userId, chatId, role, enabled, createdAt.

## 6. Phase 0: Don dep demo va nen mong

Muc tieu: Bien demo thanh codebase sach, khong con loi vat, san sang phat trien.

Checklist:

- [ ] Doi ten app/package tu `react-example` sang `crm-qlbh`.
- [ ] Sua README thanh huong dan rieng cho CRM QLBH, bo noi dung AI Studio mac dinh.
- [ ] Sua mojibake trong `vite.config.ts` comment.
- [ ] Chuan hoa env: `.env.example`, `.env.local`, Vercel env.
- [ ] Them `vercel.json` neu giu Vite SPA de route fallback ve `index.html`.
- [ ] Tach types rieng: Customer, Product, Order, OrderItem, Receipt, User, Role.
- [ ] Bo phu thuoc mock khoi store, tao API client layer.
- [ ] Them error boundary, loading state, empty state, toast thay cho `alert`.
- [ ] Chuan hoa currency/date parser cho tien Viet Nam va ngay Viet Nam.
- [ ] Them test/lint script ro rang: `typecheck`, `build`, `test`.

Tieu chi xong:

- `npm run lint` pass.
- `npm run build` pass.
- Khong con text/cmt bi loi encoding.
- Khong con nut chinh nao chi `alert` ma khong co issue/implementation target.

## 7. Phase 1: MVP dung that hang ngay

Muc tieu: Ban duoc hang, luu du lieu that, in duoc bill, theo doi mobile co login.

### 7.1 Auth va phan quyen

Roles ban dau:

- `ADMIN`: xem/sua toan bo, quan ly user, cau hinh, xoa/sua giao dich co audit.
- `ACCOUNTANT`: xem doanh thu, cong no, thu chi, khoa so, in lai bill.
- `SALE`: tao don, xem khach cua minh, xem san pham/ton kho, xem don cua minh.
- `WAREHOUSE`: xem/nhap/xuat/kiem kho, khong xem loi nhuan.
- `VIEWER`: chi xem bao cao duoc cap quyen.

Checklist:

- [ ] Tao man hinh login.
- [ ] Dung Firebase Auth hoac Auth.js/Clerk tuy muc tieu chi phi.
- [ ] Them protected routes.
- [ ] Them RBAC guard theo route/action.
- [ ] Topbar hien user that, role that, logout.
- [ ] Luu audit log moi lan tao/sua/xoa don, thu no, sua ton kho.

### 7.2 Google Sheets backend

Checklist:

- [ ] Tao Google Cloud service account.
- [ ] Share Google Sheets database cho service account.
- [ ] Viet backend API `/api/customers`, `/api/products`, `/api/orders`, `/api/receipts`, `/api/dashboard`.
- [ ] Viet sheets repository voi cache va retry.
- [ ] Validate input bang Zod.
- [ ] Chong ghi trung don khi user double click.
- [ ] Tao transaction logic mem: tao order, order items, debt ledger, inventory transaction, audit log trong cung request.
- [ ] Them idempotency key cho tao don va thu tien.

### 7.3 Import du lieu tu Excel goc

Checklist:

- [ ] Viet script `scripts/analyze-workbook.ts` de liet ke sheet, range, header, sample, anomalies.
- [ ] Viet parser cho `KHO HANG` -> `products`.
- [ ] Viet parser cho `CỬA HÀNG` -> `customers`.
- [ ] Viet parser cho `CONG NO` -> `debt_ledger`/opening balances.
- [ ] Viet parser ban dau cho cac sheet phieu theo ngay -> `sales_orders` va `sales_order_items`.
- [ ] Tao man doi soat import: so dong doc duoc, so dong loi, ly do loi.
- [ ] Khong ghi de Google Sheets san xuat neu chua co preview va xac nhan.

### 7.4 POS va in bill

Checklist:

- [ ] POS tim san pham theo ma, ten, ten hoa don, barcode.
- [ ] Chon khach nhanh, them khach nhanh ngay trong POS.
- [ ] Ghi no, tien mat, chuyen khoan, thanh toan mot phan.
- [ ] Check ton kho truoc khi thanh toan.
- [ ] Check han muc cong no va ngay no qua han.
- [ ] Luu nhap don vao local storage va dong bo khi online.
- [ ] Tao bill HTML print CSS.
- [ ] Ho tro mau bill A4, A5, K80.
- [ ] Nut `Thanh toán & In` tao don, mo print dialog, cap nhat `printedAt`.
- [ ] Co nut in lai trong Orders.
- [ ] Co ma QR chuyen khoan neu cau hinh tai khoan ngan hang.

Thong tin bill can co:

- Ten cong ty: Cong ty Gach Men Sang Phat.
- Dia chi: 07 Le Trong Tan.
- Ngay ban, so phieu, sale, khach hang, dia chi/SDT neu co.
- Bang hang: STT, ma hang, ten hang, kich thuoc, DVT, so luong, don gia, thanh tien.
- Tong tien hang, chiet khau, VAT, tong thanh toan, da tra, con no, no cu, tong no sau don.
- Ghi chu va chu ky nguoi giao/nguoi nhan.

### 7.5 Mobile/PWA

Checklist:

- [ ] Thiet ke lai shell mobile: bottom navigation cho mobile, sidebar cho desktop.
- [ ] POS mobile dung layout 1 cot, checkout sticky bottom.
- [ ] Bang du lieu tren mobile doi thanh card list co filter.
- [ ] Tat ca dialog co max-height, scroll rieng, khong tran man hinh.
- [ ] PWA installable: icon, manifest, theme color, splash.
- [ ] Draft offline cho don ban, co trang queue dong bo.
- [ ] Camera barcode/QR scan bang Web API neu thiet bi ho tro.

Tieu chi xong Phase 1:

- Login duoc tren mobile va desktop.
- Tao don that -> ghi Google Sheets -> tru kho -> tang cong no neu chua thu du.
- In bill duoc tu POS va Orders.
- Build Vercel thanh cong.
- Mot sale co the dung mobile tao don trong thuc te.

## 7.6 Settings Center cho Admin

Muc tieu: Admin cau hinh duoc toan bo he thong tu UI, khong can sua code/deploy lai.

Nhom cau hinh can co:

- Thong tin cong ty: ten, dia chi, hotline, ma so thue, logo, footer bill.
- Mau in: A4, A5, K80; hien/an cot; hien/an no cu; chu ky; QR chuyen khoan.
- Tai khoan ngan hang: ngan hang, so tai khoan, chu tai khoan, noi dung CK mac dinh.
- Kho va chi nhanh: danh sach kho, kho mac dinh, quyen truy cap theo user.
- User va role: moi user, khoa/mo khoa, reset mat khau, gan sale code, gan kho, gan khach.
- Permission matrix: xem/them/sua/xoa/in/xuat/duyet theo tung module.
- Han muc va cong no: creditLimit mac dinh, creditDays mac dinh, nguong canh bao, cho phep vuot han muc hay can duyet.
- Bang gia/chiet khau: gia theo nhom khach, gia theo so luong, nguong giam gia can duyet.
- So chung tu: prefix va quy tac sinh ma cho don ban, phieu thu, phieu chi, don nhap, phieu kho.
- Notification: bat/tat bell, nguong nhac no, gio nhac hang ngay, nguoi nhan theo vai tro.
- Telegram: token, webhook status, danh sach user da lien ket chatId.
- Backup: lich backup, noi luu Drive, so phien ban giu lai, nut backup ngay.
- Import/export: mapping cot Excel/Google Sheets, preview truoc khi import, log import.
- Bao mat: session timeout, yeu cau 2FA neu co, IP allowlist neu can, audit retention.

Man hinh Settings nen chia tab:

- `General`
- `Users & Roles`
- `Permissions`
- `Company & Print`
- `Sales & Pricing`
- `Debt Rules`
- `Inventory`
- `Notifications`
- `Integrations`
- `Backup & Data`
- `Audit Logs`

Tieu chi xong:

- Admin tao user sale moi va gan quyen duoc tren UI.
- Admin sua mau bill/QR ngan hang ma khong sua code.
- Admin cau hinh nguong no qua han va notification duoc.
- Moi thay doi settings quan trong co audit log.

## 7.7 Customer 360

Muc tieu: Mo mot khach hang la thay duoc toan bo lich su va suc khoe kinh doanh voi khach do.

Trang thong tin khach hang can co:

- Header: ten khach, ma khach, nhom, sale phu trach, SDT, dia chi, tax code, trang thai.
- KPI cards: tong doanh so, doanh so thang nay, no hien tai, no qua han, don gan nhat, ngay mua gan nhat, so ngay khong mua.
- Tab `Tong quan`: ghi chu, tag, nguoi lien he, han muc, ngay no, trang thai cham soc.
- Tab `So cong no`: ledger phai thu rieng cua khach.
- Tab `Don hang`: toan bo don ban, loc theo ngay/trang thai/sale.
- Tab `Thu tien`: phieu thu, phuong thuc, nguoi thu, anh bien nhan neu co.
- Tab `Hang hay mua`: top san pham, gia gan nhat, so luong, bien dong gia.
- Tab `Lich su cham soc`: call/note/nhac no/hen ngay xu ly.
- Tab `File`: bill PDF, anh chuyen khoan, hop dong, chung tu lien quan.
- Tab `Timeline`: gom tat ca su kien theo thoi gian: tao don, in bill, thu tien, sua thong tin, nhac no.

So cong no trong Customer 360:

- Cot: ngay, so chung tu, dien giai, phat sinh no, phat sinh co, so du, han thanh toan, tuoi no, trang thai.
- Bo loc: tat ca/chua thu/qua han/da tat toan/theo don hang.
- Hanh dong: lap phieu thu, in doi chieu cong no, gui/tao tin nhac nhac no, xuat Excel/PDF.
- Can hien ro `No dau ky`, `Phat sinh trong ky`, `Da thu trong ky`, `No cuoi ky`.

Tieu chi xong:

- Tu danh sach khach click vao la xem duoc doanh so, no, lich su mua va thu tien.
- Ke toan co the in bien ban doi chieu cong no cho tung khach.
- Sale co the xem khach minh phu trach tren mobile.

## 7.8 Supplier 360 va cong no phai tra

Muc tieu: Quan ly NCC day du nhu khach hang, de biet dang nhap cua ai, no ai, gia mua ra sao.

Trang nha cung cap can co:

- Header: ten NCC, ma NCC, SDT, dia chi, ma so thue, nguoi lien he, trang thai.
- KPI cards: tong gia tri nhap, phai tra hien tai, qua han, don nhap gan nhat, san pham dang cung cap.
- Tab `So cong no phai tra`: ledger phai tra NCC.
- Tab `Don nhap`: lich su purchase orders, trang thai nhan hang/thanh toan.
- Tab `Thanh toan`: phieu chi/thanh toan NCC.
- Tab `San pham cung cap`: ma hang, gia mua gan nhat, ngay cap nhat, ton kho lien quan.
- Tab `Timeline`: nhap hang, thanh toan, sua thong tin, dinh kem.

Tieu chi xong:

- Ke toan theo doi duoc cong no phai tra tung NCC.
- Kho/quan ly xem duoc gia mua gan nhat theo NCC.
- Co phieu chi va ledger phai tra rieng, khong tron voi cong no khach hang.

## 7.9 So cong no trung tam

Muc tieu: Co mot man hinh cong no dep, de loc, doi soat, in, xuat va hanh dong nhanh.

Man hinh can co:

- Dashboard cong no: tong phai thu, qua han, sap den han, da thu hom nay, top khach no cao.
- Aging buckets: 0-7, 8-15, 16-30, 31-60, tren 60 ngay.
- Bang cong no theo khach/NCC, co search, filter sale, nhom khach, trang thai, tuoi no.
- Drilldown tu dong vao Customer 360/Supplier 360.
- Bulk actions: tao danh sach nhac no, xuat Excel, in doi chieu, gan sale xu ly.
- Trang `Can thu hom nay`: danh sach khach den han/qua han, so tien, SDT, nut goi/copy tin nhan.
- Trang `Doi soat`: so sach theo ledger, phieu thu/chi, don hang, chenh lech neu co.

Quy tac ledger:

- Don ban ghi no: tang debit cua khach.
- Phieu thu: tang credit cua khach.
- Tra hang/giam tru: tang credit hoac tao dong dieu chinh.
- Don nhap NCC: tang credit/phai tra tuy quy uoc ke toan.
- Thanh toan NCC: giam phai tra.
- Khong sua/xoa dong ledger sau khoa so; chi tao dong dieu chinh.

Tieu chi xong:

- So du cong no tinh lai tu ledger khop voi tong hien thi tren khach/NCC.
- In/xuat doi chieu cong no dung cho tung ky.
- Co canh bao khi so tong va ledger lech nhau.

## 7.10 Trang thai hang hoa va Product 360

Muc tieu: Quan ly vong doi hang hoa, khong chi la danh sach san pham.

Trang thai hang hoa de xuat:

- `ACTIVE`: dang ban.
- `NEW`: hang moi.
- `LOW_STOCK`: sap het.
- `OUT_OF_STOCK`: het hang.
- `SLOW_MOVING`: cham ban.
- `HOLD`: tam ngung ban.
- `DISCONTINUED`: ngung kinh doanh.
- `NEED_COUNT`: can kiem kho.
- `PRICE_REVIEW`: can xem lai gia.

Product 360 can co:

- Header: ma hang, ten hoa don, ten vat tu, kich thuoc, don vi, barcode, trang thai.
- KPI: ton hien tai, gia ban, gia von/gia mua gan nhat, doanh so, loi nhuan uoc tinh, ngay ban gan nhat.
- Tab `Ton kho`: ton theo kho, min stock, lich su dieu chinh.
- Tab `The kho`: inventory transactions.
- Tab `Ban hang`: don ban co san pham nay.
- Tab `Nhap hang`: NCC, gia mua, ngay nhap.
- Tab `Bang gia`: cac gia dang ap dung theo nhom khach.
- Tab `Lich su trang thai`: ai chuyen trang thai, ly do, thoi gian.

Tieu chi xong:

- POS khong cho ban hang `HOLD`/`DISCONTINUED`, canh bao `OUT_OF_STOCK`.
- Dashboard co danh sach hang sap het/cham ban/can kiem kho.
- Admin/warehouse co the doi trang thai hang kem ly do.

## 8. Phase 1.5: Bao cao, van hanh va chong sai so

Muc tieu: Quan ly duoc cuoi ngay, doi soat duoc tien/kho/no.

Checklist:

- [ ] Dashboard lay so lieu that: doanh thu ngay/thang, thuc thu, cong no moi, so don, top hang.
- [ ] Orders co filter theo ngay, sale, khach, trang thai thanh toan.
- [ ] Finance co tuoi no: 0-7, 8-15, 16-30, tren 30 ngay.
- [ ] Receipts co danh sach phieu thu, in phieu thu.
- [ ] Inventory co the kho tung san pham.
- [ ] Khoa so ngay: sau khi khoa so, chi Admin/Accountant co quyen mo khoa/sua.
- [ ] Export Excel/PDF bao cao ngay.
- [ ] Audit log co man hinh xem va filter.
- [ ] Backup Google Sheets dinh ky sang file Excel/CSV tren Drive.

## 9. Phase 2: Nhac cong no va bell notification

Muc tieu: He thong chu dong nhac viec cho sale/ke toan.

Checklist:

- [ ] Bell notification that trong topbar, co unread count.
- [ ] Notification center: cong no qua han, don chua in, ton kho thap, don chua thu du, loi dong bo.
- [ ] Reminder rules trong Settings:
  - Nhac truoc han no N ngay.
  - Nhac khi qua han no.
  - Nhac khi khach vuot han muc.
  - Nhac khi ton kho duoi muc toi thieu.
- [ ] Cron job tren Vercel Cron hoac GitHub Actions/Cloud Scheduler de tao notification hang ngay.
- [ ] Man hinh cong no theo sale: moi sale thay danh sach khach can goi hom nay.
- [ ] Log trang thai nhac: chua nhac, da nhac, hoan, da thu.
- [ ] Them template tin nhan nhac no de copy/gui nhanh.

Tieu chi xong Phase 2:

- Moi sang he thong tu tao danh sach viec can xu ly.
- Sale nhan notification trong app.
- Ke toan thay cong no qua han va lich su nhac.

## 10. Phase 3: Telegram bot va automation cho sale

Muc tieu: Day notification ra Telegram, nhac no ban hang va nhac viec noi bo.

Checklist:

- [ ] Tao Telegram bot bang BotFather.
- [ ] Luu `TELEGRAM_BOT_TOKEN` trong Vercel env.
- [ ] Tao man hinh lien ket Telegram cho user, luu `chatId`.
- [ ] Webhook `/api/telegram/webhook` de verify user va nhan lenh.
- [ ] Gui nhac cong no hang ngay theo sale.
- [ ] Gui nhac cho ke toan khi co don ghi no lon/vuot han muc.
- [ ] Lenh bot noi bo:
  - `/today` xem cong viec hom nay.
  - `/debt <ten khach>` xem no khach.
  - `/orders <ngay>` xem don theo ngay.
  - `/paid <ma khach> <so tien>` tao yeu cau ghi nhan thu no, can ke toan duyet.
- [ ] Rate limit, audit log, va khong gui thong tin nhay cam vao nhom chung.

Tieu chi xong Phase 3:

- Sale nhan duoc nhac no tu Telegram dung khach duoc gan.
- Ke toan nhan canh bao cong no/thu tien.
- Moi thao tac qua bot co audit log va phan quyen.

## 11. Phase 4: Nang cap database va scale

Khi Google Sheets bat dau cham hoac du lieu lon:

- Chuyen primary database sang PostgreSQL/Supabase/Neon.
- Google Sheets tro thanh reporting mirror.
- Them row-level security theo role/sale.
- Them realtime dashboard.
- Them cache Redis/Upstash cho search san pham/khach.
- Them job queue cho Telegram/email/PDF.
- Them mobile native app React Native/Expo neu PWA khong du.

## 12. Danh sach loi vat/tech debt can sua som

- `package.json` ten app con la `react-example`.
- `README.md` con noi dung AI Studio mac dinh.
- `vite.config.ts` co comment bi mojibake.
- `clean` script dung `rm -rf`, khong than thien Windows PowerShell.
- `src/data/mock.ts` la nguon du lieu duy nhat.
- `src/store/data.ts` dung `typeof MOCK_*` lam type, kho mo rong.
- Cac nut nghiep vu trong Inventory/Orders/POS con `alert`.
- POS cho giam gia phan tram nhung chua validate >100 hoac so am.
- POS tru kho am duoc, chua check ton.
- POS khong co payment method `DEBT` rieng, dang suy ra no tu so tien khach tra.
- Date order chi co ngay, khong co gio tao that.
- Orders hien gio bang `new Date(order.date).toLocaleTimeString`, voi date-only se sai nghia.
- Customer/Product add form chua validate trung ma/trung SĐT.
- Finance thu no co the thu vuot no, khong tao receipt record rieng.
- Layout con nhieu table ngang, can card/mobile list.
- Dialog mobile can gioi han chieu cao va scroll.
- Chua co toast, confirm dialog, undo/restore.
- Chua co test tu dong.

## 13. Thu tu uu tien thuc thi de nhanh co ban dung that

1. Don dep codebase, sua README/env/vercel route/build scripts.
2. Tao schema Google Sheets moi va backend repository.
3. Tao login/RBAC/protected route.
4. Dung Settings Center toi thieu: company, users, roles, permissions, bill, debt rules.
5. Import `KHO HANG`, `CỬA HÀNG`, `CONG NO` tu Excel sang Sheets moi.
6. Chuyen Products/Customers/Finance doc tu API.
7. Lam Customer 360 toi thieu: thong tin, don hang, so cong no, phieu thu.
8. Lam Product 360 toi thieu: thong tin, ton kho, the kho, trang thai hang.
9. Chuyen POS tao don that qua API.
10. Them in bill HTML/CSS va print flow.
11. Lam So cong no trung tam: aging, loc, in doi chieu, xuat Excel.
12. Lam Supplier 360 va phai tra NCC.
13. Lam responsive mobile/PWA cho POS, Orders, Customers, Finance, Customer 360.
14. Them dashboard that va khoa so/audit log.
15. Them notification/cong no reminder.
16. Them Telegram bot.

## 14. Cau hinh Vercel can co

Env de xuat:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `JWT_SECRET` neu dung custom auth
- `TELEGRAM_BOT_TOKEN` cho Phase 3
- `APP_BASE_URL`

Vercel checks:

- Build command: `npm run build`.
- Output directory: `dist`.
- SPA fallback: rewrite tat ca route ve `/index.html`.
- API routes phai khong expose service account key ra client bundle.

## 15. Verification checklist

Moi phase chi coi la xong khi co bang chung:

- TypeScript: `npm run lint`.
- Production build: `npm run build`.
- Mobile smoke: iPhone width 390px, Android width 412px, desktop 1440px.
- POS smoke:
  - Login sale.
  - Chon khach.
  - Them 2 san pham.
  - Thanh toan mot phan.
  - In bill.
  - Kiem tra order, order items, debt ledger, inventory transaction trong Google Sheets.
- Finance smoke:
  - Lap phieu thu.
  - No khach giam dung.
  - Lich su cong no co dong moi.
- RBAC smoke:
  - Sale khong thay cau hinh user.
  - Accountant khong sua san pham neu khong duoc quyen.
  - Admin xem audit log.
- Deploy smoke:
  - URL Vercel vao duoc `/`, `/login`, `/pos`, `/orders`, reload route khong 404.

## 16. Trang thai kiem tra hien tai

Da kiem tra ngay 2026-07-07:

- Da chay UTF-8 preflight, terminal hien tieng Viet dung.
- Da cai dependencies bang `npm.cmd install`.
- `npm.cmd run lint` pass.
- `npm.cmd run build` pass.
- `npm audit` trong qua trinh install bao `found 0 vulnerabilities`.

Ket luan: demo hien tai build duoc, nhung moi la frontend mock. De dung thuc te can uu tien Phase 0 va Phase 1 truoc khi deploy san xuat cho nhan vien.

## 17. Cap nhat schema/API van hanh

Da bo sung them nen de quan ly no va upload du lieu:

- `order_debts`: theo doi no theo tung don.
- `receipt_allocations`: tra mot phan, mot phieu thu chia cho nhieu don.
- `debt_assignments`: giao no cho tung ca nhan phu trach.
- `debt_reminders` va `debt_reminder_logs`: lich nhac no va lich su nhac.
- `payment_promises`: cam ket tra no.
- `customer_contacts`: nguoi lien he thanh toan.
- `import_batches` va `import_errors`: lich su upload/import file.
- `products.product_type`: phan loai `RAW_MATERIAL`, `SEMI_FINISHED`, `FINISHED`, `MERCHANDISE`.
- API template/upload cho `customers`, `suppliers`, `products`.
- API `orders/create`: tao don, chi tiet don, cong no theo don, phieu thu neu co, ledger, cashbook, ton kho, audit log.
- API `receipts/create`: thu tien, tra mot phan, tu phan bo vao cac don no cu nhat neu khong chi dinh allocation.
- Frontend POS va Finance da goi API that khi co `INTERNAL_API_SECRET`, fallback mock khi chua cau hinh backend.
