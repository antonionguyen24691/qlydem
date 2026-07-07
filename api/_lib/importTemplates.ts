export type ImportEntity = "customers" | "suppliers" | "products";

export type TemplateColumn = {
  key: string;
  label: string;
  required?: boolean;
  sample: string | number;
  aliases?: string[];
};

export const IMPORT_TEMPLATES: Record<ImportEntity, TemplateColumn[]> = {
  customers: [
    { key: "code", label: "Mã khách hàng", required: true, sample: "KH001", aliases: ["ma khach hang", "ma kh", "customer code"] },
    { key: "name", label: "Tên khách hàng", required: true, sample: "CỬA HÀNG NHỰT NGA", aliases: ["ten khach hang", "khach hang", "ben mua hang"] },
    { key: "short_name", label: "Tên ngắn", sample: "NHỰT NGA", aliases: ["ten ngan", "short name"] },
    { key: "phone", label: "Số điện thoại", sample: "0900000000", aliases: ["sdt", "dien thoai", "phone"] },
    { key: "address", label: "Địa chỉ", sample: "07 Lê Trọng Tấn", aliases: ["dia chi", "address"] },
    { key: "tax_code", label: "Mã số thuế", sample: "6000000000", aliases: ["mst", "ma so thue", "tax code"] },
    { key: "customer_group", label: "Nhóm khách", sample: "RETAIL", aliases: ["nhom khach", "group"] },
    { key: "credit_limit", label: "Hạn mức nợ", sample: 50000000, aliases: ["han muc no", "credit limit"] },
    { key: "credit_days", label: "Số ngày nợ", sample: 15, aliases: ["ngay no", "credit days"] },
    { key: "current_debt", label: "Nợ đầu kỳ", sample: 0, aliases: ["no dau ky", "con no", "current debt"] },
    { key: "note", label: "Ghi chú", sample: "Khách quen", aliases: ["ghi chu", "note"] }
  ],
  suppliers: [
    { key: "code", label: "Mã nhà cung cấp", required: true, sample: "NCC001", aliases: ["ma nha cung cap", "ma ncc", "supplier code"] },
    { key: "name", label: "Tên nhà cung cấp", required: true, sample: "CÔNG TY GẠCH MEN SANG PHÁT", aliases: ["ten nha cung cap", "ten ncc", "supplier"] },
    { key: "short_name", label: "Tên ngắn", sample: "SANG PHÁT", aliases: ["ten ngan"] },
    { key: "phone", label: "Số điện thoại", sample: "0900000000", aliases: ["sdt", "dien thoai"] },
    { key: "address", label: "Địa chỉ", sample: "Đắk Lắk", aliases: ["dia chi"] },
    { key: "tax_code", label: "Mã số thuế", sample: "6000000000", aliases: ["mst", "ma so thue"] },
    { key: "contact_person", label: "Người liên hệ", sample: "Anh A", aliases: ["nguoi lien he"] },
    { key: "payment_terms", label: "Điều khoản thanh toán", sample: "Thanh toán trong 15 ngày", aliases: ["dieu khoan thanh toan"] },
    { key: "current_payable", label: "Phải trả đầu kỳ", sample: 0, aliases: ["phai tra dau ky", "no nha cung cap"] },
    { key: "note", label: "Ghi chú", sample: "NCC chính", aliases: ["ghi chu"] }
  ],
  products: [
    { key: "code", label: "Mã hàng", required: true, sample: "UT483001", aliases: ["ma hang", "sku", "product code"] },
    { key: "product_name", label: "Tên hàng hóa", required: true, sample: "Gạch UT483001 Loại 1 6 viên", aliases: ["ten hang hoa", "ten vat tu", "ten hang"] },
    { key: "invoice_name", label: "Tên trên HĐ", sample: "Gạch 40*80 MS UT483001 Loại 1 6 viên", aliases: ["ten tren hd", "ten tren hoa don"] },
    { key: "product_type", label: "Loại hàng", sample: "FINISHED", aliases: ["loai hang", "loai san pham"] },
    { key: "category", label: "Danh mục", sample: "Gạch ốp tường", aliases: ["danh muc"] },
    { key: "brand", label: "Thương hiệu", sample: "Sang Phát", aliases: ["thuong hieu"] },
    { key: "size", label: "Kích thước", sample: "400x800", aliases: ["kich thuoc"] },
    { key: "unit", label: "Đơn vị tính", sample: "HỘP", aliases: ["dvt", "don vi tinh"] },
    { key: "m2_per_box", label: "M2 / hộp", sample: 1.92, aliases: ["m2", "m2 hop"] },
    { key: "pieces_per_box", label: "Số viên trong hộp", sample: 6, aliases: ["so v trong hop", "so vien trong hop"] },
    { key: "price_by_m2", label: "Giá theo M2", sample: 114000, aliases: ["gia theo m2"] },
    { key: "sell_price_box_vat", label: "Giá hộp VAT", sample: 193778, aliases: ["gia hop vat"] },
    { key: "cost_price", label: "Giá vốn", sample: 150000, aliases: ["gia von"] },
    { key: "vat_rate", label: "VAT %", sample: 8, aliases: ["vat"] },
    { key: "barcode", label: "Barcode", sample: "893000000001", aliases: ["ma vach"] },
    { key: "lifecycle_status", label: "Trạng thái hàng", sample: "ACTIVE", aliases: ["trang thai hang"] },
    { key: "status", label: "Trạng thái", sample: "ACTIVE", aliases: ["trang thai"] }
  ]
};

export function isImportEntity(value: string | undefined): value is ImportEntity {
  return value === "customers" || value === "suppliers" || value === "products";
}

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildHeaderMap(entity: ImportEntity) {
  const map = new Map<string, string>();
  for (const column of IMPORT_TEMPLATES[entity]) {
    map.set(normalizeHeader(column.label), column.key);
    map.set(normalizeHeader(column.key), column.key);
    for (const alias of column.aliases ?? []) map.set(normalizeHeader(alias), column.key);
  }
  return map;
}

export function getRequiredKeys(entity: ImportEntity) {
  return IMPORT_TEMPLATES[entity].filter((column) => column.required).map((column) => column.key);
}
