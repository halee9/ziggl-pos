import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useKDSStore } from '../stores/kdsStore';
import HomeScreen from './HomeScreen';

// Mock fetch globally (already in setup.ts)
const mockedFetch = vi.mocked(global.fetch);

// Helper to set session store state
function setSession(overrides: Partial<ReturnType<typeof useSessionStore.getState>> = {}) {
  useSessionStore.setState({
    restaurantCode: 'MIDORI',
    restaurantName: 'Midori',
    role: 'owner',
    staffName: 'Owner',
    theme: 'dark',
    ...overrides,
  });
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeScreen />
    </MemoryRouter>
  );
}

describe('HomeScreen — Force Close Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to return summary + orders
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, totalTips: 0,
        today: { revenue: 0, orders: 0 },
        yesterday: { revenue: 0, orders: 0 },
        orders: [],
      }),
      text: async () => '{}',
    } as Response);

    // Reset KDS store with mock order counts
    useKDSStore.setState({
      orders: [],
      connected: true,
    });
  });

  it('shows "Online Open" badge for owner when force_closed is false', () => {
    setSession({ forceClosed: false });
    renderHome();

    expect(screen.getByText('Online Open')).toBeInTheDocument();
  });

  it('shows "Online Closed" badge for owner when force_closed is true', () => {
    setSession({ forceClosed: true });
    renderHome();

    expect(screen.getByText('Online Closed')).toBeInTheDocument();
  });

  it('does not show force close toggle for staff role', () => {
    setSession({ role: 'staff', forceClosed: false });
    renderHome();

    expect(screen.queryByText('Online Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Online Closed')).not.toBeInTheDocument();
  });

  it('calls API and updates state when toggling force close', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ force_closed: true }),
      text: async () => '{}',
    } as Response);

    setSession({ forceClosed: false });
    renderHome();

    const toggleBtn = screen.getByTestId('force-close-toggle');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      // Should have called PUT /api/admin/MIDORI
      const calls = mockedFetch.mock.calls;
      const putCall = calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('/api/admin/') && (c[1] as any)?.method === 'PUT'
      );
      expect(putCall).toBeDefined();

      // Body should include force_closed: true
      const body = JSON.parse((putCall![1] as any).body);
      expect(body.force_closed).toBe(true);
    });
  });
});
