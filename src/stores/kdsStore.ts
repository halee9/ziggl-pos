import { create } from 'zustand';
import type { KDSOrder, OrderStatus, MenuDisplayConfig } from '../types';

type FilterType = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';

interface KDSState {
  // 상태
  orders: KDSOrder[];
  filter: FilterType;
  connected: boolean;
  printOrder: KDSOrder | null;
  menuDisplayConfig: MenuDisplayConfig;

  // 주문 액션
  setOrders: (orders: KDSOrder[]) => void;
  addOrder: (order: KDSOrder) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string) => void;

  // UI 액션
  setFilter: (filter: FilterType) => void;
  setConnected: (connected: boolean) => void;
  setPrintOrder: (order: KDSOrder | null) => void;
  setMenuDisplayConfig: (config: MenuDisplayConfig) => void;

  // 파생 상태
  filteredOrders: () => KDSOrder[];
  orderCounts: () => { open: number; inProgress: number; ready: number; completed: number };
}

export const useKDSStore = create<KDSState>()((set, get) => ({
  orders: [],
  filter: 'ALL',
  connected: false,
  printOrder: null,
  menuDisplayConfig: { menuItems: [], modifiers: [] },

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => {
      if (state.orders.find((o) => o.id === order.id)) return state; // 중복 방지
      return { orders: [order, ...state.orders] };
    }),

  updateOrderStatus: (id, status) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
      ),
    })),

  cancelOrder: (id) =>
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== id),
    })),

  setFilter: (filter) => set({ filter }),
  setConnected: (connected) => set({ connected }),
  setPrintOrder: (printOrder) => set({ printOrder }),
  setMenuDisplayConfig: (menuDisplayConfig) => set({ menuDisplayConfig }),

  filteredOrders: () => {
    const { orders, filter } = get();
    return filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);
  },

  orderCounts: () => {
    const { orders } = get();
    return {
      open: orders.filter((o) => o.status === 'OPEN').length,
      inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
      ready: orders.filter((o) => o.status === 'READY').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
    };
  },
}));
