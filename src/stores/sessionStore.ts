import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PosRole } from '../types';

export type KDSTab = 'active' | 'scheduled' | 'ready-done' | 'cancelled';
export type ViewMode = 'list' | 'card';
export type Theme = 'light' | 'dark';

interface SessionState {
  restaurantCode: string | null;
  restaurantName: string;
  timezone: string;
  role: PosRole;
  staffName: string;
  pin: string;
  theme: Theme;
  activeTab: KDSTab;
  viewMode: ViewMode;
  forceClosed: boolean;
  login: (code: string, name: string, role?: PosRole, staffName?: string, pin?: string, timezone?: string) => void;
  logout: () => void;
  setTheme: (theme: Theme) => void;
  setActiveTab: (tab: KDSTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setForceClosed: (closed: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      restaurantCode: null,
      restaurantName: '',
      timezone: 'America/Los_Angeles',
      role: 'owner' as PosRole,
      staffName: '',
      pin: '',
      theme: 'dark' as Theme,
      activeTab: 'active',
      viewMode: 'list',   // 기본값: list view
      forceClosed: false,
      login: (code, name, role = 'owner', staffName = '', pin = '', timezone = 'America/Los_Angeles') =>
        set({ restaurantCode: code, restaurantName: name, role, staffName, pin, timezone }),
      logout: () =>
        set({ restaurantCode: null, restaurantName: '', timezone: 'America/Los_Angeles', role: 'owner', staffName: '', pin: '', forceClosed: false }),
      setTheme: (theme) => set({ theme }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setViewMode: (viewMode) => set({ viewMode }),
      setForceClosed: (forceClosed) => set({ forceClosed }),
    }),
    {
      name: 'kds-session',
      partialize: (state) => ({
        restaurantCode: state.restaurantCode,
        restaurantName: state.restaurantName,
        timezone: state.timezone,
        role: state.role,
        staffName: state.staffName,
        pin: state.pin,
        theme: state.theme,
        activeTab: state.activeTab,
        viewMode: state.viewMode,
        forceClosed: state.forceClosed,
      }),
    }
  )
);
