export const MOCK_CUSTOMERS = [
  { id: "C01", name: "CỬA HÀNG NHỰT NGA", phone: "0901234567", address: "Quận 1, TP.HCM", oldDebt: 5000000, creditLimit: 20000000 },
  { id: "C02", name: "DŨNG HOA", phone: "0912345678", address: "Quận Tân Bình, TP.HCM", oldDebt: 12500000, creditLimit: 50000000 },
  { id: "C03", name: "ANH TUẤN XÂY DỰNG", phone: "0987654321", address: "Quận 7, TP.HCM", oldDebt: 0, creditLimit: 10000000 },
];

export const MOCK_ORDERS = [
  {
    id: "ORD-001",
    date: "2026-06-21",
    customerId: "C01",
    customerName: "CỬA HÀNG NHỰT NGA",
    oldDebt: 5000000,
    items: [
      { id: "P01", name: "Gạch 600x600. 65002 loại 1", size: "600x600", unit: "HỘP", quantity: 4, price: 122000, total: 488000 }
    ],
    total: 488000
  },
  {
    id: "ORD-002",
    date: "2026-06-21",
    customerId: "C02",
    customerName: "DŨNG HOA",
    oldDebt: 12500000,
    items: [
      { id: "P02", name: "Gạch 500x500. 51001 loại 1", size: "500x500", unit: "HỘP", quantity: 0, price: 0, total: 0 },
      { id: "P03", name: "Gạch 40*80 MS UT483002D Loại 1 6 viên", size: "400*800", unit: "HỘP", quantity: 25.5, price: 185000, total: 4717500 },
      { id: "P04", name: "Gạch 80*80 MS 68102 Loại 1", size: "800x800", unit: "HỘP", quantity: 10, price: 210000, total: 2100000 },
      { id: "P05", name: "Gạch 600x600, 6653 loại 1", size: "600x600", unit: "HỘP", quantity: 10, price: 135000, total: 1350000 },
      { id: "P06", name: "Gạch lát M600x600 loại 1 K3", size: "600x600", unit: "HỘP", quantity: 0, price: 0, total: 0 }
    ],
    total: 8167500
  },
  {
    id: "ORD-003",
    date: "2026-06-22",
    customerId: "C03",
    customerName: "ANH TUẤN XÂY DỰNG",
    oldDebt: 0,
    items: [
      { id: "P07", name: "Xi măng Hà Tiên Đa Dụng", size: "50kg", unit: "BAO", quantity: 100, price: 85000, total: 8500000 }
    ],
    total: 8500000
  }
];

export const MOCK_PRODUCTS = [
  { id: "P01", code: "G600-65002", name: "Gạch 600x600. 65002 loại 1", category: "Gạch lát nền", size: "600x600", unit: "HỘP", stock: 150, price: 122000, cost: 100000 },
  { id: "P02", code: "G500-51001", name: "Gạch 500x500. 51001 loại 1", category: "Gạch lát nền", size: "500x500", unit: "HỘP", stock: 200, price: 95000, cost: 80000 },
  { id: "P03", code: "G4080-UT483", name: "Gạch 40*80 MS UT483002D Loại 1 6 viên", category: "Gạch ốp tường", size: "400*800", unit: "HỘP", stock: 50, price: 185000, cost: 150000 },
  { id: "P04", code: "G8080-68102", name: "Gạch 80*80 MS 68102 Loại 1", category: "Gạch lát nền", size: "800x800", unit: "HỘP", stock: 80, price: 210000, cost: 180000 },
  { id: "P05", code: "G600-6653", name: "Gạch 600x600, 6653 loại 1", category: "Gạch lát nền", size: "600x600", unit: "HỘP", stock: 120, price: 135000, cost: 110000 },
  { id: "P07", code: "XM-HT", name: "Xi măng Hà Tiên Đa Dụng", category: "Vật liệu thô", size: "50kg", unit: "BAO", stock: 500, price: 85000, cost: 80000 },
];
