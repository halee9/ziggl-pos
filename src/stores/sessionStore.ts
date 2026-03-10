import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type KDSTab = 'active' | 'scheduled' | 'ready' | 'done';
export type ViewMode = 'list' | 'card';

interface SessionState {
  restaurantCode: string | null;
  restaurantName: string;
  activeTab: KDSTab;
  viewMode: ViewMode;
  login: (code: string, name: string) => void;
  logout: () => void;
  setActiveTab: (tab: KDSTab) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantCode: null,
      restaurantName: '',
      activeTab: 'active',
      viewMode: 'list',   // 기본값: list view
      login: (code, name) => set({ restaurantCode: code, restaurantName: name }),
      logout: () => set({ restaurantCode: null, restaurantName: '' }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'kds-session',
      partialize: (state) => ({
        restaurantCode: state.restaurantCode,
        restaurantName: state.restaurantName,
        activeTab: state.activeTab,
        viewMode: state.viewMode,
      }),
    }
  )
);
