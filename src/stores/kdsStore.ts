import { create } from 'zustand';
import type { KDSOrder, OrderStatus, MenuDisplayConfig } from '../types';

type FilterType = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';

const ACTIVATION_KEY = 'kds_activation_minutes';
const DEFAULT_ACTIVATION = 20;
const SEP_KEY = 'kds_section_separation';

interface KDSState {
  // 상태
  orders: KDSOrder[];
  filter: FilterType;
  connected: boolean;
  printOrder: KDSOrder | null;
  menuDisplayConfig: MenuDisplayConfig;

  // KDS 설정 (localStorage 영속화)
  scheduledActivationMinutes: number;
  sectionSeparation: boolean;

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
  setScheduledActivationMinutes: (minutes: number) => void;
  setSectionSeparation: (v: boolean) => void;

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
  scheduledActivationMinutes: parseInt(localStorage.getItem(ACTIVATION_KEY) ?? String(DEFAULT_ACTIVATION)),
  sectionSeparation: localStorage.getItem(SEP_KEY) !== 'false',

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

  setScheduledActivationMinutes: (minutes) => {
    localStorage.setItem(ACTIVATION_KEY, String(minutes));
    set({ scheduledActivationMinutes: minutes });
  },

  setSectionSeparation: (v) => {
    localStorage.setItem(SEP_KEY, String(v));
    set({ sectionSeparation: v });
  },

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
