import { create } from 'zustand';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS, MOCK_ORDERS } from '../data/mock';

export type Customer = typeof MOCK_CUSTOMERS[0];
export type Product = typeof MOCK_PRODUCTS[0];
export type OrderItem = typeof MOCK_ORDERS[0]['items'][0];

export interface Order {
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
  addCustomer: (customer: Customer) => void;
  addProduct: (product: Product) => void;
  addOrder: (order: Order) => void;
  updateCustomerDebt: (customerId: string, amountChange: number) => void;
  updateProductStock: (productId: string, quantityChange: number) => void;
}

const INITIAL_ORDERS: Order[] = MOCK_ORDERS.map(o => ({
  ...o,
  paid: o.total,
  status: "Đã thanh toán"
}));

export const useDataStore = create<DataStore>((set) => ({
  customers: MOCK_CUSTOMERS,
  products: MOCK_PRODUCTS,
  orders: INITIAL_ORDERS,
  addCustomer: (customer) => set((state) => ({ customers: [customer, ...state.customers] })),
  addProduct: (product) => set((state) => ({ products: [product, ...state.products] })),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
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
}));
