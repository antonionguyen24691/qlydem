import { create } from 'zustand';
import { Product as StoreProduct } from './data';

export interface CartItem extends StoreProduct {
  quantity: number;
  total: number;
}

interface POSStore {
  cart: CartItem[];
  addToCart: (product: StoreProduct, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updatePrice: (productId: string, price: number) => void;
  updateUnit: (productId: string, unit: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const usePOSStore = create<POSStore>((set, get) => ({
  cart: [],
  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existing = state.cart.find((item) => item.id === product.id);
      if (existing) {
        return {
          cart: state.cart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
              : item
          ),
        };
      }
      return {
        cart: [...state.cart, { ...product, quantity, total: quantity * product.price }],
      };
    });
  },
  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== productId),
    }));
  },
  updateQuantity: (productId, quantity) => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === productId
          ? { ...item, quantity, total: quantity * item.price }
          : item
      ),
    }));
  },
  updatePrice: (productId, price) => {
    const safePrice = Math.max(0, Math.round(price || 0));
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === productId
          ? { ...item, price: safePrice, total: item.quantity * safePrice }
          : item
      ),
    }));
  },
  updateUnit: (productId, unit) => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === productId ? { ...item, unit } : item
      ),
    }));
  },
  clearCart: () => set({ cart: [] }),
  getCartTotal: () => {
    return get().cart.reduce((total, item) => total + item.total, 0);
  },
}));
