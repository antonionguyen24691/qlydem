# Update de xuat: Role giao hang va phieu xuat kho co ky nhan

Trang thai: De xuat san, chua dua vao ban dang dung.

Ngay lap: 2026-07-09

## Muc tieu

Bo sung vai tro nguoi giao hang va nang cap phieu xuat kho de khi in/tao phieu co day du chuoi trach nhiem:

- Ke toan xuat kho: nguoi lap/xac nhan phieu xuat kho tren he thong.
- Nguoi giao hang: nguoi nhan hang tu kho va di giao.
- Ben nhan hang: khach hang, cong trinh, dai ly, hoac nguoi duoc uy quyen ky nhan.

Phieu xuat kho can hien ro ten tung nguoi lien quan va co khu vuc ky nhan rieng, de dung lam chung tu noi bo va doi chieu cong no/hang da giao.

## Hien trang role

He thong hien co cac role chinh:

- `ADMIN`: quan tri toan bo.
- `ACCOUNTANT`: ke toan, xem don, khach hang, tai chinh, bao cao, xuat file.
- `SALE`: ban hang, khach hang, tao yeu cau xuat kho.
- `WAREHOUSE`: kho, hang hoa, ton kho, nhap/xuat/kiem ke.

De xuat bo sung:

- `DELIVERY`: giao hang.

## Quyen de xuat cho DELIVERY

`DELIVERY` khong nen co quyen sua gia, sua cong no, sua ton kho truc tiep. Role nay chi nen co quyen thao tac theo phieu duoc gan:

- Xem danh sach phieu giao hang duoc gan cho minh.
- Xem chi tiet phieu xuat kho/giao hang.
- Cap nhat trang thai giao hang: dang giao, da giao, giao mot phan, khong giao duoc.
- Nhap ghi chu giao hang.
- Thu thap chu ky/xac nhan ben nhan neu he thong co chu ky dien tu.
- Tai/in phieu giao hang cua don duoc gan.

Khong cho phep:

- Sua so luong hang tren phieu da xuat, tru khi tao yeu cau dieu chinh.
- Sua gia ban, tong tien, cong no.
- Xoa phieu xuat kho.
- Duyet xuat kho.
- Sua danh muc hang hoa hoac ton kho.

## Luong nghiep vu de xuat

1. Sale hoac ke toan tao don ban hang.
2. Ke toan xac nhan thong tin don, cong no, dieu kien thanh toan.
3. Kho chuan bi hang va tao/xac nhan phieu xuat kho.
4. Ke toan xuat kho xac nhan phieu xuat kho tren he thong.
5. He thong gan nguoi giao hang cho phieu.
6. Nguoi giao hang nhan hang, trang thai chuyen sang `Dang giao`.
7. Ben nhan ky/xac nhan khi nhan hang.
8. Nguoi giao hang cap nhat ket qua giao hang.
9. He thong luu log nguoi thao tac, thoi gian, trang thai va ghi chu.

## Thong tin can co tren phieu xuat kho

Phan thong tin chung:

- Ma phieu xuat kho.
- Ma don ban hang/lien ket hoa don.
- Ngay lap phieu.
- Kho xuat.
- Khach hang/ben nhan.
- Dia chi giao.
- So dien thoai ben nhan.
- Ghi chu giao hang.

Phan hang hoa:

- Ma hang.
- Ten hang theo cau hinh in hoa don/phieu.
- Quy cach.
- Don vi tinh.
- So luong xuat.
- So luong giao thuc te neu co giao mot phan.
- Ghi chu tung dong hang neu can.

Phan nguoi phu trach va ky nhan:

- Ke toan xuat kho: hien ten nguoi dang nhap da xac nhan xuat kho.
- Nguoi giao hang: hien ten user role `DELIVERY` duoc gan.
- Ben nhan hang: ten nguoi nhan, so dien thoai, chu ky/xac nhan.
- Thu kho neu can: ten nguoi xac nhan hang roi kho.

## Mau khu vuc ky tren phieu

Phieu in nen co 3 den 4 cot ky:

- Ke toan xuat kho
  - Ho ten: lay tu user dang xac nhan xuat kho.
  - Chu ky.
- Nguoi giao hang
  - Ho ten: lay tu user duoc gan giao hang.
  - Chu ky.
- Ben nhan hang
  - Ho ten: nhap luc giao hoac lay tu thong tin khach.
  - So dien thoai neu co.
  - Chu ky/xac nhan.
- Thu kho
  - Tuy chon, neu muon tach vai tro kho voi ke toan xuat kho.

## Trang thai phieu de xuat

Phieu xuat kho/giao hang nen co cac trang thai:

- `DRAFT`: moi tao, chua xac nhan.
- `READY_TO_PICK`: da san sang soan hang.
- `EXPORTED`: da xuat kho.
- `ASSIGNED_DELIVERY`: da gan nguoi giao hang.
- `IN_DELIVERY`: dang giao.
- `DELIVERED`: da giao thanh cong.
- `PARTIAL_DELIVERED`: giao mot phan.
- `FAILED_DELIVERY`: giao khong thanh cong.
- `CANCELLED`: da huy.

## Du lieu can bo sung khi trien khai

Bang/field de xuat:

- Them role `DELIVERY` vao bang `roles`.
- Them field tren phieu xuat kho hoac bang giao hang:
  - `export_accountant_id`
  - `export_accountant_name_snapshot`
  - `warehouse_staff_id`
  - `warehouse_staff_name_snapshot`
  - `delivery_user_id`
  - `delivery_user_name_snapshot`
  - `receiver_name`
  - `receiver_phone`
  - `receiver_signature_url`
  - `delivery_status`
  - `delivery_note`
  - `delivered_at`
- Bang log trang thai:
  - `stock_delivery_logs`
  - gom `stock_out_id`, `actor_id`, `actor_role`, `from_status`, `to_status`, `note`, `created_at`.

Nen luu snapshot ten nguoi tai thoi diem xuat/giao hang, de sau nay user doi ten thi phieu cu van giu dung ten tren chung tu.

## Man hinh can bo sung

Cho admin/ke toan/kho:

- Chon nguoi giao hang khi lap/xac nhan phieu xuat kho.
- Xem trang thai giao hang theo phieu.
- In lai phieu xuat kho co day du ten ke toan xuat kho, nguoi giao hang, ben nhan.

Cho nguoi giao hang:

- Man hinh "Phieu can giao".
- Xem chi tiet hang can giao.
- Nut cap nhat: Bat dau giao, Da giao, Giao mot phan, Khong giao duoc.
- O ghi chu giao hang.
- O nhap ten nguoi nhan va so dien thoai.
- Vung ky nhan neu trien khai chu ky dien tu.

## Nguyen tac phan quyen

- `ADMIN`: quan ly tat ca phieu, gan lai nguoi giao hang, sua/duyet cac truong hop can can thiep.
- `ACCOUNTANT`: tao/xac nhan phieu xuat kho, chon nguoi giao hang, in phieu.
- `WAREHOUSE`: xac nhan soan hang/xuat kho, khong sua cong no.
- `SALE`: xem trang thai giao hang cua don minh phu trach, khong duyet xuat kho.
- `DELIVERY`: chi xem va cap nhat cac phieu duoc gan.

## RLS/API can luu y

- API doc phieu giao hang can loc theo `delivery_user_id` khi role la `DELIVERY`.
- API cap nhat trang thai cua `DELIVERY` chi cho phep cac field lien quan giao hang.
- Moi thay doi trang thai phai ghi log.
- Cac hanh dong xuat kho lam thay doi ton kho van phai do `ADMIN`, `ACCOUNTANT`, hoac `WAREHOUSE` thuc hien theo quy dinh.

## Thu tu trien khai de xuat

1. Them role `DELIVERY` va permission doc/cap nhat phieu duoc gan.
2. Bo sung schema phieu xuat kho/giao hang va bang log.
3. Cap nhat API xuat kho de luu ke toan xuat kho va nguoi giao hang.
4. Cap nhat mau in phieu xuat kho.
5. Them man hinh danh sach phieu giao cho role `DELIVERY`.
6. Them man hinh quan ly/duyet trang thai giao hang cho admin/ke toan/kho.
7. Kiem thu voi cac case: giao thanh cong, giao mot phan, khong giao duoc, in lai phieu.

## Update de xuat: He thong Telegram bot 2 lop

Trang thai: De xuat san, chua dua vao ban dang dung.

Muc tieu:

- Dung Telegram nhu kenh thao tac nhanh cho noi bo va khach hang.
- Tach 2 bot rieng de khong tron du lieu noi bo voi khach hang.
- Tat ca lenh quan trong phai co auth, phan quyen, audit log va lien ket ve app.
- Bot khong thay the app chinh; bot chi la lop thao tac nhanh, nhac viec, tra cuu, tao yeu cau.

### 1. Bot noi bo: PMQL Ops Bot

Ten de xuat:

- `PMQL Ops Bot`
- Username de xuat: `pmql_ops_bot`

Pham vi dung:

- Chay trong group noi bo cong ty.
- Phuc vu admin, sale, ke toan, kho, giao hang.
- Quan ly dat hang, don hang, cong no, ton kho, giao hang, dinh vi xe giao hang.
- Co the gui thong bao chu dong vao group va inbox rieng tung user.

Kenh dung:

- Group tong noi bo: nhan thong bao quan trong.
- Group sale: don moi, khach can cham soc, nhac no theo sale.
- Group kho: don can soan, de nghi xuat kho, kiem ke lech.
- Group giao hang: phieu giao, trang thai xe, dia diem giao.
- Inbox rieng user: viec duoc gan rieng, thong bao nhay cam.

Vai tro noi bo duoc ho tro:

- `ADMIN`: xem/tim/tac dong toan bo, duyet lenh, gan nguoi phu trach.
- `ACCOUNTANT`: xem cong no, xac nhan thu tien, xac nhan xuat kho, nhac no.
- `SALE`: tao yeu cau dat hang, xem don/khach cua minh, xem cong no khach minh phu trach.
- `WAREHOUSE`: nhan lenh soan hang, xac nhan xuat kho, bao het hang, bao lech kho.
- `DELIVERY`: nhan phieu giao, cap nhat trang thai giao hang, gui dinh vi, ghi chu giao.
- `VIEWER`: chi xem bao cao/tong quan neu duoc cap.

Nguyen tac auth noi bo:

- Moi Telegram user phai lien ket voi user app bang ma OTP.
- Admin tao/link user trong app, bot khong tu cap quyen.
- Bang lien ket de xuat: `telegram_accounts`.
- Mot user app co the lien ket nhieu chat id neu can, nhung mac dinh 1 user = 1 Telegram account.
- Neu user bi khoa trong app thi bot tu choi thao tac.
- Moi lenh trong group phai kiem tra role cua nguoi goi lenh.

Lenh noi bo de xuat:

- `/start`: gioi thieu va huong dan link tai khoan.
- `/link <ma_otp>`: lien ket Telegram voi user app.
- `/me`: xem ten, role, trang thai lien ket.
- `/help`: danh sach lenh theo role.
- `/today`: viec can xu ly hom nay theo role.
- `/orders today`: don trong ngay.
- `/order <ma_don>`: xem chi tiet don.
- `/neworder`: bat dau tao yeu cau don hang nhanh.
- `/customer <ten_or_sdt>`: tim khach hang.
- `/debt <ten_or_sdt>`: xem cong no khach.
- `/collect <ma_khach> <so_tien>`: tao yeu cau ghi nhan thu tien, can ke toan/admin xac nhan.
- `/inventory <ma_hang>`: xem ton kho mot ma hang.
- `/lowstock`: danh sach hang het/sap het.
- `/picklist`: danh sach don can soan/xuat kho.
- `/stockout <ma_don>`: ke toan/kho xac nhan tao phieu xuat kho.
- `/assign_delivery <ma_phieu> @user`: gan nguoi giao hang.
- `/delivery`: danh sach phieu giao cua toi.
- `/delivering <ma_phieu>`: cap nhat dang giao.
- `/delivered <ma_phieu>`: cap nhat da giao.
- `/partial <ma_phieu>`: bao giao mot phan.
- `/failed <ma_phieu> <ly_do>`: bao giao that bai.
- `/loc <ma_phieu>`: gui/yeu cau dinh vi giao hang.
- `/route today`: xem tuyen giao hang hom nay.
- `/approve`: danh sach lenh can duyet.
- `/approve <ma_lenh>`: duyet lenh.
- `/reject <ma_lenh> <ly_do>`: tu choi lenh.
- `/report today`: bao cao nhanh ngay.
- `/sync`: admin kich hoat sync Google Sheets neu can.

Luon thong bao noi bo de xuat:

- Don ban moi duoc tao.
- Don ghi no vuot han muc.
- Khach qua han thanh toan.
- Phieu thu moi can doi soat.
- De nghi xuat kho moi.
- Kho xac nhan da soan/xuat hang.
- Gan phieu giao cho nguoi giao hang.
- Nguoi giao hang bat dau giao.
- Nguoi giao hang gui dinh vi.
- Giao thanh cong/giao mot phan/giao that bai.
- Kiem ke lech can admin duyet.
- Hang het/sap het theo nguong min stock.
- Loi sync Google Sheets/Vercel Cron/API.

### 2. Bot khach hang: PMQL Customer Bot

Ten de xuat:

- `PMQL Customer Bot`
- Username de xuat: `pmql_customer_bot`

Pham vi dung:

- Bot cho khach hang/chu cua hang/dai ly/cong trinh.
- Ho tro dat hang, hoi gia, hoi ton, tra cuu don, tra cuu cong no, cham soc khach hang.
- Khong cho khach thay du lieu noi bo, gia von, loi nhuan, danh sach khach khac.

Kenh dung:

- Inbox rieng khach hang.
- Co the gan link bot tren bill, QR, Zalo/Facebook, website.
- Neu dung group voi khach lon thi bot chi tra loi thong tin cua khach da lien ket.

Nguyen tac auth khach hang:

- Khach co the dung so dien thoai de lien ket tai khoan.
- Bot gui OTP hoac admin/sale xac nhan lien ket.
- Mot Telegram chat co the link voi mot `customer_id`.
- Neu la dai ly co nhieu nguoi mua, can bang `customer_contacts` de gan nhieu contact vao cung mot customer.
- Khach chi xem don, cong no, gia, hang hoa duoc phep cho chinh customer cua minh.

Lenh khach hang de xuat:

- `/start`: gioi thieu bot va cach lien ket.
- `/link <sdt_or_ma_khach>`: yeu cau lien ket tai khoan khach.
- `/me`: xem thong tin khach dang lien ket.
- `/catalog`: xem danh muc hang.
- `/search <ten_or_ma_hang>`: tim hang hoa.
- `/price <ma_hang>`: hoi gia ban hien tai.
- `/stock <ma_hang>`: hoi tinh trang con hang/het hang theo muc duoc phep hien.
- `/order`: bat dau dat hang.
- `/cart`: xem gio hang tam.
- `/add <ma_hang> <so_luong>`: them hang vao gio.
- `/remove <ma_hang>`: bo hang khoi gio.
- `/checkout`: gui yeu cau dat hang cho sale/ke toan xac nhan.
- `/orders`: xem don gan day cua khach.
- `/order <ma_don>`: xem trang thai don.
- `/debt`: xem cong no hien tai.
- `/payment`: lay thong tin chuyen khoan/QR.
- `/support`: tao yeu cau cham soc khach hang.
- `/feedback <noi_dung>`: gui phan hoi.

Luon cham soc khach hang de xuat:

- Xac nhan da nhan yeu cau dat hang.
- Sale/ke toan da xac nhan don.
- Don da xuat kho.
- Don dang giao.
- Don da giao.
- Nhac thanh toan den han/qua han.
- Gui lai QR chuyen khoan.
- Bao hang ve lai neu truoc do het hang.
- Gui khuyen mai/bang gia neu admin bat tinh nang nay.

### 3. Du lieu can bo sung cho Telegram

Bang de xuat:

- `telegram_bots`
  - `id`
  - `bot_key`: `OPS` hoac `CUSTOMER`
  - `username`
  - `display_name`
  - `status`
  - `created_at`
- `telegram_accounts`
  - `id`
  - `bot_key`
  - `telegram_user_id`
  - `telegram_username`
  - `telegram_first_name`
  - `telegram_last_name`
  - `chat_id`
  - `app_user_id`
  - `customer_id`
  - `contact_id`
  - `role_snapshot`
  - `status`
  - `linked_at`
  - `last_seen_at`
- `telegram_groups`
  - `id`
  - `bot_key`
  - `chat_id`
  - `title`
  - `group_type`: `OPS_MAIN`, `SALE`, `WAREHOUSE`, `DELIVERY`, `ACCOUNTING`, `CUSTOMER`
  - `status`
  - `created_at`
- `telegram_sessions`
  - `id`
  - `bot_key`
  - `chat_id`
  - `telegram_user_id`
  - `flow`
  - `state_json`
  - `expires_at`
  - `created_at`
  - `updated_at`
- `telegram_messages`
  - `id`
  - `bot_key`
  - `chat_id`
  - `telegram_user_id`
  - `direction`: `IN` hoac `OUT`
  - `message_type`
  - `text`
  - `payload_json`
  - `entity_type`
  - `entity_id`
  - `created_at`
- `telegram_command_logs`
  - `id`
  - `bot_key`
  - `chat_id`
  - `telegram_user_id`
  - `app_user_id`
  - `customer_id`
  - `command`
  - `args_json`
  - `result`
  - `error`
  - `created_at`
- `telegram_notification_rules`
  - `id`
  - `bot_key`
  - `event_type`
  - `target_group_type`
  - `target_role`
  - `enabled`
  - `template`
  - `created_at`

Bang nghiep vu lien quan can mo rong:

- `sales_orders`
  - them `telegram_source_chat_id`
  - them `telegram_source_user_id`
  - them `customer_order_request_id` neu don den tu bot khach.
- `stock_delivery_logs`
  - them `telegram_message_id`
  - them `location_lat`
  - them `location_lng`
  - them `location_accuracy`
  - them `location_at`
- `customer_contacts`
  - them `telegram_user_id`
  - them `telegram_username`
  - them `preferred_channel`

### 4. API/Webhook de xuat

Endpoint server:

- `POST /api/telegram/ops/webhook`
  - webhook cho bot noi bo.
- `POST /api/telegram/customer/webhook`
  - webhook cho bot khach hang.
- `POST /api/telegram/send`
  - API noi bo de gui message tu app/cron.
- `POST /api/telegram/link`
  - tao/link OTP.
- `GET /api/telegram/status`
  - admin xem trang thai bot, webhook, group, user linked.
- `POST /api/telegram/set-webhook`
  - admin cau hinh webhook len Telegram.

Env can co:

- `TELEGRAM_OPS_BOT_TOKEN`
- `TELEGRAM_CUSTOMER_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_OPS_ALLOWED_GROUP_IDS`
- `TELEGRAM_CUSTOMER_BOT_ENABLED`
- `TELEGRAM_OPS_BOT_ENABLED`
- `APP_PUBLIC_URL`

Bao mat webhook:

- Dung secret token cua Telegram webhook.
- Chi chap nhan request co header `X-Telegram-Bot-Api-Secret-Token`.
- Khong log token.
- Tach token ops/customer.
- Rate limit theo `chat_id` va `telegram_user_id`.

### 5. AI/hoi dap cho bot khach hang

Bot khach hang co the co 2 che do:

- Rule-based truoc: lenh ro rang, tra loi theo du lieu app.
- AI assistant sau: hoi dap tu catalog, FAQ, chinh sach giao hang/thanh toan, thong tin don cua khach.

Nguyen tac AI:

- AI khong duoc tu chot gia neu gia khong co trong database.
- AI khong duoc hua giao hang neu kho/ke toan chua xac nhan.
- AI khong duoc tiet lo gia von, cong no khach khac, doanh thu noi bo.
- Neu cau hoi lien quan khieu nai, doi tra, cong no lon, gia dac biet thi tao ticket cho nhan vien.
- Moi cau tra loi co thong tin don/cong no phai dua tren customer da lien ket.

Nguon tri thuc de xuat:

- Catalog san pham dang ban.
- Bang gia hien hanh.
- Chinh sach thanh toan.
- Chinh sach giao hang.
- FAQ cua cong ty.
- Trang thai don cua chinh khach.
- Cong no cua chinh khach.

### 6. Workflow noi bo mau

Tao don tu group sale:

1. Sale go `/neworder`.
2. Bot hoi khach hang.
3. Sale chon/tim khach.
4. Bot hoi danh sach hang va so luong.
5. Bot tao `order_request` hoac draft sales order.
6. Ke toan/admin xac nhan gia/cong no.
7. Bot thong bao group kho soan hang.
8. Kho xac nhan xuat kho.
9. Bot gan nguoi giao hang.
10. Giao hang cap nhat vi tri/trang thai.
11. Bot thong bao don da giao va cap nhat app.

Theo doi xe giao hang:

1. Admin/ke toan go `/route today`.
2. Bot tra danh sach phieu dang giao.
3. Nguoi giao hang gui location trong Telegram.
4. Bot luu vao `stock_delivery_logs`.
5. Group noi bo xem cap nhat: xe nao, phieu nao, vi tri gan nhat, thoi gian.
6. Khi giao xong bot yeu cau nguoi giao hang cap nhat `delivered/partial/failed`.

Nhac cong no noi bo:

1. Cron tao danh sach no den han.
2. Bot gui vao group sale hoac inbox sale phu trach.
3. Sale bam/lenh `promise` de ghi ngay khach hen tra.
4. Ke toan xac nhan khi thu tien.
5. Bot ghi log da nhac, da hen, da thu.

### 7. Workflow khach hang mau

Khach dat hang:

1. Khach go `/order` hoac nhan nut "Dat hang".
2. Bot hoi/tim san pham.
3. Khach them so luong.
4. Bot hien tom tat gio hang.
5. Khach xac nhan gui yeu cau.
6. Bot tao `customer_order_request`.
7. Sale/ke toan nhan thong bao noi bo.
8. Nhan vien xac nhan thanh don ban chinh thuc.
9. Bot bao lai khach ma don va trang thai.

Khach hoi cong no:

1. Khach go `/debt`.
2. Bot kiem tra lien ket customer.
3. Bot tra tong no hien tai, cac don con no.
4. Bot gui thong tin QR thanh toan neu khach can.
5. Neu khach bao da chuyen khoan, bot tao ticket doi soat cho ke toan.

Cham soc khach hang:

1. Khach go `/support`.
2. Bot hoi loai yeu cau: don hang, giao hang, thanh toan, bao hanh/doi tra, khac.
3. Bot tao ticket/noi dung cham soc.
4. Sale hoac ke toan duoc gan xu ly.
5. Moi phan hoi duoc log lai theo customer timeline.

### 8. Man hinh admin can bo sung trong app

Tab Settings -> Telegram:

- Trang thai 2 bot: enabled/disabled, webhook ok/fail.
- Form nhap token bot ops/customer.
- Nut set webhook.
- Danh sach group da lien ket.
- Danh sach user noi bo da link Telegram.
- Danh sach customer/contact da link Telegram.
- Cau hinh notification rules.
- Cau hinh template tin nhan.
- Test gui tin den group/user.
- Log webhook/error gan nhat.

Customer 360:

- Tab Telegram/contact: ai dang lien ket bot khach.
- Lich su tin nhan quan trong.
- Nut gui QR/thong bao don/noi dung cham soc.

Order/Delivery:

- Hien nguon don: app hay bot khach.
- Hien log cap nhat tu Telegram.
- Hien vi tri giao hang gan nhat neu co.

### 9. Thu tu trien khai Telegram de xuat

Phase TG-0: Nen mong

1. Tao 2 bot qua BotFather.
2. Them env token vao Vercel.
3. Tao schema Telegram.
4. Tao webhook skeleton cho 2 bot.
5. Tao Settings -> Telegram de set webhook va xem status.

Phase TG-1: Bot noi bo MVP

1. Link Telegram user voi user app.
2. Cho `/me`, `/today`, `/orders today`, `/order`, `/debt`, `/inventory`.
3. Gui notification don moi, cong no, ton kho thap vao group noi bo.
4. Ghi `telegram_command_logs` va `telegram_messages`.

Phase TG-2: Bot noi bo van hanh kho/giao hang

1. Lenh picklist, stockout, assign_delivery.
2. Lenh delivery/delivering/delivered/partial/failed.
3. Nhan location va luu vao delivery logs.
4. Dashboard xem tuyen giao hang/vi tri gan nhat.

Phase TG-3: Bot khach hang MVP

1. Link khach bang SDT/OTP.
2. Cho `/catalog`, `/search`, `/price`, `/stock`, `/orders`, `/order`, `/debt`, `/payment`.
3. Tao yeu cau dat hang tu bot, nhan vien xac nhan trong app.
4. Gui trang thai don cho khach.

Phase TG-4: Cham soc + AI

1. Them `/support`, feedback, ticket.
2. Them FAQ/catalog AI assistant co guardrail.
3. Them template cham soc, nhac thanh toan, hang ve lai.
4. Bao cao hieu qua cham soc khach hang.

### 10. Rủi ro va luu y khi lam Telegram

- Khong gui thong tin nhay cam vao group lon neu khong can.
- Cong no chi gui cho nguoi co quyen hoac khach da link dung.
- Khong de customer bot tao don chinh thuc truc tiep neu chua co nhan vien xac nhan.
- Moi lenh tao/sua/duyet phai ghi audit log.
- Phai co idempotency de tranh Telegram retry lam tao trung don.
- Phai co rate limit de tranh spam.
- Phai co che do tat bot khan cap tu Settings.
- Neu dung AI, phai co guardrail ve gia, ton kho, cong no va thong tin noi bo.
- Dinh vi giao hang chi luu khi nguoi giao hang chu dong gui location hoac da dong y quy dinh noi bo.

## Ghi chu

Tai lieu nay chi la ban thiet ke nang cap. Chua thay doi schema, code, permission hay UI cua ban dang chay.
