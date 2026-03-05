import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'card' | 'list';

interface SessionState {
  restaurantCode: string | null;
  restaurantName: string;
  viewMode: ViewMode;
  login: (code: string, name: string) => void;
  logout: () => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantCode: null,
      restaurantName: '',
      viewMode: 'card',
      login: (code, name) => set({ restaurantCode: code, restaurantName: name }),
      logout: () => set({ restaurantCode: null, restaurantName: '' }),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'kds-session',
      // restaurantCode, restaurantName, viewMode를 localStorage에 저장
      partialize: (state) => ({
        restaurantCode: state.restaurantCode,
        restaurantName: state.restaurantName,
        viewMode: state.viewMode,
      }),
    }
  )
);
