import { create } from 'zustand';
import type { KDSOrder, OrderStatus, MenuDisplayConfig } from '../types';
import { isScheduledOrder } from '../utils/isScheduledOrder';

const ACTIVATION_KEY = 'kds_activation_minutes';
const DEFAULT_ACTIVATION = 20;
const AUTO_START_KEY = 'kds_auto_start';
const AUTO_PRINT_KEY = 'kds_auto_print';
const SOUND_ENABLED_KEY = 'kds_sound_enabled';
const SOUND_VOLUME_KEY  = 'kds_sound_volume';

// 긴급도 임계값 (분)
const URGENCY_YELLOW_KEY = 'kds_urgency_yellow';
const URGENCY_ORANGE_KEY = 'kds_urgency_orange';
const URGENCY_RED_KEY    = 'kds_urgency_red';
const DEFAULT_URGENCY_YELLOW = 5;
const DEFAULT_URGENCY_ORANGE = 10;
const DEFAULT_URGENCY_RED    = 15;

interface KDSState {
  // 상태
  orders: KDSOrder[];
  connected: boolean;
  printOrder: KDSOrder | null;
  menuDisplayConfig: MenuDisplayConfig;

  // KDS 설정 (localStorage 영속화)
  scheduledActivationMinutes: number;
  autoStartOrders: boolean;
  autoPrint: boolean;

  // 알림 사운드
  soundEnabled: boolean;
  soundVolume: number; // 0–100

  // 긴급도 색상 임계값 (분)
  urgencyYellowMin: number;
  urgencyOrangeMin: number;
  urgencyRedMin: number;

  // 주문 액션
  setOrders: (orders: KDSOrder[]) => void;
  addOrder: (order: KDSOrder) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string) => void;

  // UI 액션
  setConnected: (connected: boolean) => void;
  setPrintOrder: (order: KDSOrder | null) => void;
  setMenuDisplayConfig: (config: MenuDisplayConfig) => void;
  setScheduledActivationMinutes: (minutes: number) => void;
  setAutoStartOrders: (v: boolean) => void;
  setAutoPrint: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setSoundVolume: (v: number) => void;
  setUrgencyYellowMin: (v: number) => void;
  setUrgencyOrangeMin: (v: number) => void;
  setUrgencyRedMin: (v: number) => void;

  // 파생 상태
  orderCounts: () => { pendingPayment: number; active: number; scheduled: number; readyDone: number; cancelled: number };
}

export const useKDSStore = create<KDSState>()((set, get) => ({
  orders: [],
  connected: false,
  printOrder: null,
  menuDisplayConfig: { menuItems: [], modifiers: [] },
  scheduledActivationMinutes: parseInt(localStorage.getItem(ACTIVATION_KEY) ?? String(DEFAULT_ACTIVATION)),
  autoStartOrders: localStorage.getItem(AUTO_START_KEY) !== 'false',
  autoPrint: localStorage.getItem(AUTO_PRINT_KEY) === 'true',
  soundEnabled: localStorage.getItem(SOUND_ENABLED_KEY) !== 'false', // default true
  soundVolume: parseInt(localStorage.getItem(SOUND_VOLUME_KEY) ?? '80'),
  urgencyYellowMin: parseInt(localStorage.getItem(URGENCY_YELLOW_KEY) ?? String(DEFAULT_URGENCY_YELLOW)),
  urgencyOrangeMin: parseInt(localStorage.getItem(URGENCY_ORANGE_KEY) ?? String(DEFAULT_URGENCY_ORANGE)),
  urgencyRedMin:    parseInt(localStorage.getItem(URGENCY_RED_KEY)    ?? String(DEFAULT_URGENCY_RED)),

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => {
      if (state.orders.find((o) => o.id === order.id)) return state; // 중복 방지
      return { orders: [order, ...state.orders] };
    }),

  updateOrderStatus: (id, status) =>
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== id) return o;
        const now = new Date().toISOString();
        return {
          ...o,
          status,
          updatedAt: now,
          // 각 상태에 처음 도달한 시각만 기록 — 백워드 전환 시 덮어쓰지 않음
          ...(status === 'IN_PROGRESS' && !o.startedAt ? { startedAt: now } : {}),
          ...(status === 'READY' && !o.readyAt ? { readyAt: now } : {}),
          ...(status === 'COMPLETED' && !o.completedAt ? { completedAt: now } : {}),
        };
      }),
    })),

  cancelOrder: (id) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, status: 'CANCELED' as OrderStatus, updatedAt: new Date().toISOString() } : o
      ),
    })),

  setConnected: (connected) => set({ connected }),
  setPrintOrder: (printOrder) => set({ printOrder }),
  setMenuDisplayConfig: (menuDisplayConfig) => set({ menuDisplayConfig }),

  setScheduledActivationMinutes: (minutes) => {
    localStorage.setItem(ACTIVATION_KEY, String(minutes));
    set({ scheduledActivationMinutes: minutes });
  },

  setAutoStartOrders: (v) => {
    localStorage.setItem(AUTO_START_KEY, String(v));
    set({ autoStartOrders: v });
  },

  setAutoPrint: (v) => {
    localStorage.setItem(AUTO_PRINT_KEY, String(v));
    set({ autoPrint: v });
  },

  setSoundEnabled: (v) => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(v));
    set({ soundEnabled: v });
  },

  setSoundVolume: (v) => {
    localStorage.setItem(SOUND_VOLUME_KEY, String(v));
    set({ soundVolume: v });
  },

  setUrgencyYellowMin: (v) => {
    localStorage.setItem(URGENCY_YELLOW_KEY, String(v));
    set({ urgencyYellowMin: v });
  },
  setUrgencyOrangeMin: (v) => {
    localStorage.setItem(URGENCY_ORANGE_KEY, String(v));
    set({ urgencyOrangeMin: v });
  },
  setUrgencyRedMin: (v) => {
    localStorage.setItem(URGENCY_RED_KEY, String(v));
    set({ urgencyRedMin: v });
  },

  orderCounts: () => {
    const { orders } = get();
    return {
      pendingPayment: orders.filter((o) => o.status === 'PENDING_PAYMENT').length,
      active:    orders.filter((o) => (o.status === 'OPEN' || o.status === 'IN_PROGRESS') && !isScheduledOrder(o, Date.now(), get().scheduledActivationMinutes)).length,
      scheduled: orders.filter((o) => (o.status === 'OPEN' || o.status === 'IN_PROGRESS') && isScheduledOrder(o, Date.now(), get().scheduledActivationMinutes)).length,
      // READY만 표시 (COMPLETED는 제외 — 실질적으로 중요한 건 READY)
      readyDone: orders.filter((o) => o.status === 'READY').length,
      cancelled: orders.filter((o) => o.status === 'CANCELED').length,
    };
  },
}));
