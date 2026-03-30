import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

// Mock adminStore
vi.mock('../../stores/adminStore', () => ({
  useAdminStore: Object.assign(
    (selector?: (s: any) => any) => {
      const state = {
        restaurantCode: 'midori',
        pin: '1234',
        theme: 'light',
        config: { timezone: 'America/Los_Angeles' },
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        restaurantCode: 'midori',
        pin: '1234',
        theme: 'light',
        config: { timezone: 'America/Los_Angeles' },
      }),
    }
  ),
}));

// Mock recharts to avoid SVG rendering issues in tests
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: any) => <>{children}</>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Cell: ({ children }: any) => <>{children}</>,
  LabelList: () => null,
}));

// Mock OrderDetailPanel
vi.mock('@/components/OrderDetailPanel', () => ({
  default: ({ order, onClose }: any) => order ? <div data-testid="order-detail">{order.displayId}<button onClick={onClose}>Close</button></div> : null,
}));

// Mock Popover/Calendar to avoid Radix rendering issues in tests
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <>{children}</>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverContent: () => null,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => null,
}));

// Import after mocks
import AdminLiveDashboardPage from './AdminLiveDashboardPage';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SUMMARY = {
  totalRevenue: 150000,
  totalOrders: 25,
  avgOrderValue: 6000,
  cancelRate: 4.0,
  totalTips: 18000,
  totalTax: 12000,
  totalCommission: 5000,
  netRevenue: 115000,
  canceledOrders: 1,
};

const MOCK_HOURLY = [
  { hour: 11, orders: 5, revenue: 30000 },
  { hour: 12, orders: 10, revenue: 60000 },
  { hour: 13, orders: 8, revenue: 45000 },
];

const MOCK_SOURCES = [
  { source: 'Kiosk', orders: 15, revenue: 90000, commission: 0 },
  { source: 'Online', orders: 10, revenue: 60000, commission: 5000 },
];

const MOCK_PAYMENT_METHODS = [
  { method: 'CARD', orders: 20, revenue: 120000 },
  { method: 'CASH', orders: 5, revenue: 30000 },
];

const MOCK_ITEMS = [
  { name: 'Salmon Roll', quantity: 12, revenue: 48000 },
  { name: 'Miso Soup', quantity: 8, revenue: 16000 },
  { name: 'Edamame', quantity: 6, revenue: 9000 },
];

const MOCK_STAFF = [
  { id: 's1', name: 'Alice', is_active: true },
  { id: 's2', name: 'Bob', is_active: true },
  { id: 's3', name: 'Carol', is_active: true },
];

const MOCK_ACTIVE_ORDERS = [
  { id: 'ord1', displayId: '#042', source: 'Kiosk', status: 'OPEN', displayName: 'John', totalMoney: 2500, createdAt: '2026-03-29T09:30:00Z', lineItems: [] },
  { id: 'ord2', displayId: '#043', source: 'Online', status: 'IN_PROGRESS', displayName: 'Jane', totalMoney: 3800, createdAt: '2026-03-29T09:45:00Z', lineItems: [] },
  { id: 'ord3', displayId: '#044', source: 'Kiosk', status: 'PENDING_PAYMENT', displayName: 'Dave', totalMoney: 1500, createdAt: '2026-03-29T10:00:00Z', lineItems: [] },
];

const MOCK_TIME_ENTRIES = [
  { id: 'te1', staff_id: 's1', staff_name: 'Alice', clock_in: '2026-03-29T09:02:00Z', clock_out: null },
  { id: 'te2', staff_id: 's2', staff_name: 'Bob', clock_in: '2026-03-29T08:00:00Z', clock_out: '2026-03-29T14:15:00Z' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupMockFetch(overrides: Record<string, any> = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(overrides.summary ?? MOCK_SUMMARY) });
    }
    if (url.includes('/hourly')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: overrides.hourly ?? MOCK_HOURLY }) });
    }
    if (url.includes('/sources')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: overrides.sources ?? MOCK_SOURCES }) });
    }
    if (url.includes('/payment-methods')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: overrides.paymentMethods ?? MOCK_PAYMENT_METHODS }) });
    }
    if (url.includes('/items')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: overrides.items ?? MOCK_ITEMS }) });
    }
    if (url.includes('/history')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ orders: overrides.activeOrders ?? MOCK_ACTIVE_ORDERS, total: (overrides.activeOrders ?? MOCK_ACTIVE_ORDERS).length }) });
    }
    if (url.includes('/time-entries')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: overrides.timeEntries ?? MOCK_TIME_ENTRIES }) });
    }
    if (url.includes('/staff/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ staff: overrides.staff ?? MOCK_STAFF }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminLiveDashboardPage />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminLiveDashboardPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setupMockFetch();
  });

  // ── 매출 요약 카드 ──────────────────────────────────────────────────────────

  it('displays sales summary cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument();       // totalRevenue
      expect(screen.getByText(/Net \$1,150/)).toBeInTheDocument();  // netRevenue (smaller text)
      expect(screen.getByText('25')).toBeInTheDocument();            // orders
      expect(screen.getByText(/Tips \$180\.00/)).toBeInTheDocument(); // tips (smaller text)
    });
  });

  // ── Staff clock 상태 ────────────────────────────────────────────────────────

  it('shows staff clock-in status correctly', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });
    // Check status labels: "In since" for clocked in, "time — time" for clocked out, "Not clocked in" for absent
    expect(screen.getByText(/In since/)).toBeInTheDocument();
    expect(screen.getByText(/—/)).toBeInTheDocument(); // clock in — clock out
    expect(screen.getByText('Not clocked in')).toBeInTheDocument();
  });

  // ── 차트 섹션 ──────────────────────────────────────────────────────────────

  it('renders all chart sections', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Hourly Sales')).toBeInTheDocument();
      expect(screen.getByText('By Source')).toBeInTheDocument();
      expect(screen.getByText('By Payment Method')).toBeInTheDocument();
      expect(screen.getByText('By Item')).toBeInTheDocument();
    });
  });

  // ── 60초 폴링 ──────────────────────────────────────────────────────────────

  it('sets up 60-second polling interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    const initialCallCount = mockFetch.mock.calls.length;

    // Advance 60 seconds
    await vi.advanceTimersByTimeAsync(60_000);

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    vi.useRealTimers();
  });

  // ── 수동 새로고침 ──────────────────────────────────────────────────────────

  it('refreshes data when refresh button is clicked', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    const callCountBefore = mockFetch.mock.calls.length;
    const refreshBtn = screen.getByLabelText('Refresh');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // ── 날짜 선택 ──────────────────────────────────────────────────────────────

  it('shows date in header and allows navigation with prev/next buttons', async () => {
    renderPage();
    await waitFor(() => {
      // Should display today's date in header
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    });

    // Should have prev/next date navigation buttons
    expect(screen.getByLabelText('Previous day')).toBeInTheDocument();
    expect(screen.getByLabelText('Next day')).toBeInTheDocument();
  });

  it('fetches data for the selected date when navigating', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    const callCountBefore = mockFetch.mock.calls.length;
    const prevBtn = screen.getByLabelText('Previous day');
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  it('disables next button when viewing today', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    const nextBtn = screen.getByLabelText('Next day');
    expect(nextBtn).toBeDisabled();
  });

  // ── Active Orders ─────────────────────────────────────────────────────────

  it('renders active orders section with order list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Active Orders')).toBeInTheDocument();
      expect(screen.getByText('#042')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('#043')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });
  });

  it('shows "No active orders" when none exist', async () => {
    setupMockFetch({ activeOrders: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No active orders')).toBeInTheDocument();
    });
  });

  // ── 빈 데이터 ──────────────────────────────────────────────────────────────

  it('displays zero values when no orders exist', async () => {
    setupMockFetch({
      summary: {
        totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, cancelRate: 0,
        totalTips: 0, totalTax: 0, totalCommission: 0, netRevenue: 0, canceledOrders: 0,
      },
      hourly: [],
      sources: [],
      paymentMethods: [],
      items: [],
      staff: MOCK_STAFF,
      timeEntries: [],
    });

    renderPage();
    await waitFor(() => {
      // Revenue card shows $0.00
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      // Orders card shows 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });
  });
});
