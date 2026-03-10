import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type KDSTab = 'active' | 'scheduled' | 'ready' | 'done';

interface SessionState {
  restaurantCode: string | null;
  restaurantName: string;
  activeTab: KDSTab;
  login: (code: string, name: string) => void;
  logout: () => void;
  setActiveTab: (tab: KDSTab) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantCode: null,
      restaurantName: '',
      activeTab: 'active',
      login: (code, name) => set({ restaurantCode: code, restaurantName: name }),
      logout: () => set({ restaurantCode: null, restaurantName: '' }),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: 'kds-session',
      partialize: (state) => ({
        restaurantCode: state.restaurantCode,
        restaurantName: state.restaurantName,
        activeTab: state.activeTab,
      }),
    }
  )
);
