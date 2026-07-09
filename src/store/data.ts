import { create } from 'zustand';
import { getAuthHeaders } from '../lib/supabase';

export interface Customer {
  id: string;
  code?: string;
  name: string;
  phone: string;
  address: string;
  oldDebt: number;
  creditLimit: number;
  note?: string;
  customerGroup?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  invoiceName?: string;
  productType?: string;
  category: string;
  size: string;
  unit: string;
  stock: number;
  price: number;
  cost: number;
  m2PerBox?: number;
  piecesPerBox?: number;
  priceByM2?: number;
  vatRate?: number;
  status?: string;
  lifecycleStatus?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  size: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  dbId?: string;
  id: string;
  date: string;
  customerName: string;
  customerId?: string;
  oldDebt?: number;
  items: OrderItem[];
  total: number;
  paid: number;
  status: string;
}

interface DataStore {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  isLiveData: boolean;
  isLoadingLiveData: boolean;
  liveDataError?: string;
  addCustomer: (customer: Customer) => void;
  upsertCustomerLocal: (customer: Customer) => void;
  addProduct: (product: Product) => void;
  addOrder: (order: Order) => void;
  upsertProductLocal: (product: Product) => void;
  updateCustomerDebt: (customerId: string, amountChange: number) => void;
  updateProductStock: (productId: string, quantityChange: number) => void;
  loadLiveData: () => Promise<void>;
}

async function fetchRows(table: string) {
  const response = await fetch(`/api/data/${table}`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error(`Không đọc được ${table}`);
  const body = await response.json();
  if (!body.ok) throw new Error(body.error ?? `Không đọc được ${table}`);
  return body.rows ?? [];
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    code: row.code,
    name: row.name ?? row.short_name ?? row.code,
    phone: row.phone ?? "",
    address: row.address ?? "",
    oldDebt: money(row.current_debt ?? row.oldDebt),
    creditLimit: money(row.credit_limit ?? row.creditLimit),
    note: row.note ?? "",
    customerGroup: row.customer_group ?? ""
  };
}

function mapProduct(row: any, stockByProduct: Map<string, number>): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.product_name ?? row.invoice_name ?? row.code,
    invoiceName: row.invoice_name ?? "",
    productType: row.product_type ?? "",
    category: row.category ?? row.product_type ?? "",
    size: row.size ?? "",
    unit: row.unit ?? "",
    stock: stockByProduct.get(row.id) ?? 0,
    price: money(row.sell_price_box_vat ?? row.price_by_m2),
    cost: money(row.cost_price),
    m2PerBox: money(row.m2_per_box),
    piecesPerBox: money(row.pieces_per_box),
    priceByM2: money(row.price_by_m2),
    vatRate: money(row.vat_rate),
    status: row.status ?? "ACTIVE",
    lifecycleStatus: row.lifecycle_status ?? "ACTIVE"
  };
}

function mapOrder(row: any, items: any[], customers: Customer[]): Order {
  const customer = customers.find((item) => item.id === row.customer_id);
  const orderItems = items.filter((item) => item.order_id === row.id).map((item) => ({
    id: item.product_id ?? item.product_code ?? item.id,
    name: item.product_name,
    size: "",
    unit: item.unit ?? "",
    quantity: money(item.quantity),
    price: money(item.unit_price),
    total: money(item.line_total)
  }));

  return {
    dbId: row.id,
    id: row.code ?? row.id,
    date: String(row.order_date ?? row.created_at ?? "").slice(0, 10),
    customerName: customer?.name ?? "Khách lẻ",
    customerId: row.customer_id,
    items: orderItems,
    total: money(row.total_amount),
    paid: money(row.paid_amount),
    status: money(row.debt_amount) > 0 ? "Nợ" : "Đã thanh toán"
  };
}

export const useDataStore = create<DataStore>((set, get) => ({
  customers: [],
  products: [],
  orders: [],
  isLiveData: false,
  isLoadingLiveData: false,
  addCustomer: (customer) => set((state) => ({ customers: [customer, ...state.customers] })),
  upsertCustomerLocal: (customer) => set((state) => {
    const exists = state.customers.some((item) => item.id === customer.id || item.code === customer.code);
    return {
      customers: exists
        ? state.customers.map((item) => item.id === customer.id || item.code === customer.code ? { ...item, ...customer } : item)
        : [customer, ...state.customers]
    };
  }),
  addProduct: (product) => set((state) => ({ products: [product, ...state.products] })),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
  upsertProductLocal: (product) => set((state) => {
    const exists = state.products.some((item) => item.id === product.id || item.code === product.code);
    return {
      products: exists
        ? state.products.map((item) => item.id === product.id || item.code === product.code ? { ...item, ...product } : item)
        : [product, ...state.products]
    };
  }),
  updateCustomerDebt: (customerId, amountChange) => set((state) => ({
    customers: state.customers.map(c =>
      c.id === customerId ? { ...c, oldDebt: c.oldDebt + amountChange } : c
    )
  })),
  updateProductStock: (productId, quantityChange) => set((state) => ({
    products: state.products.map(p =>
      p.id === productId ? { ...p, stock: p.stock + quantityChange } : p
    )
  })),
  loadLiveData: async () => {
    if (get().isLoadingLiveData) return;
    set({ isLoadingLiveData: true, liveDataError: undefined });
    try {
      const [customerRows, productRows, inventoryRows, orderRows, orderItemRows] = await Promise.all([
        fetchRows("customers"),
        fetchRows("products"),
        fetchRows("inventory_balances"),
        fetchRows("sales_orders"),
        fetchRows("sales_order_items")
      ]);

      const stockByProduct = new Map<string, number>();
      for (const row of inventoryRows) {
        stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + money(row.quantity_box));
      }

      const customers = customerRows.map(mapCustomer);
      const products = productRows.map((row: any) => mapProduct(row, stockByProduct));
      const orders = orderRows.map((row: any) => mapOrder(row, orderItemRows, customers));
      set({ customers, products, orders, isLiveData: true, isLoadingLiveData: false });
    } catch (error) {
      set({
        isLiveData: false,
        isLoadingLiveData: false,
        liveDataError: error instanceof Error ? error.message : "Không đồng bộ được dữ liệu"
      });
    }
  }
}));
