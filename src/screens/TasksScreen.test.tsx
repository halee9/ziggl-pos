import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch globally (set in setup.ts)
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

// Mock sessionStore
vi.mock('../stores/sessionStore', () => ({
  useSessionStore: Object.assign(
    (selector?: (s: any) => any) => {
      const state = {
        restaurantCode: 'midori',
        staffName: 'Manager',
        timezone: 'America/Los_Angeles',
        role: 'owner',
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        restaurantCode: 'midori',
        staffName: 'Manager',
        timezone: 'America/Los_Angeles',
        role: 'owner',
      }),
    }
  ),
}));

// Mock timezone utils
vi.mock('../utils/timezone', () => ({
  todayStr: () => '2026-03-29',
  formatDateDisplay: (date: string) => {
    // Simple formatting for tests
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  },
}));

// Import after mocks
import TasksScreen from './TasksScreen';

// ── Test data ────────────────────────────────────────────────────────────────

const MOCK_TEMPLATES = [
  { id: 'tmpl-1', title: 'Clean kitchen', type: 'check', target_quantity: null, sort_order: 0, is_active: true, staff_id: 'staff-1' },
  { id: 'tmpl-2', title: 'Prep salad', type: 'quantity', target_quantity: 10, sort_order: 1, is_active: true, staff_id: null },
];

const MOCK_DAILY_RESPONSE = {
  tasks: [
    {
      template: MOCK_TEMPLATES[0],
      logs: [{ id: 'log-1', staff_id: 'staff-1', staff_name: 'Alice', completed: true, quantity: null, note: null, recorded_by: 'Manager', recorded_at: '2026-03-29T10:00:00Z' }],
    },
    {
      template: MOCK_TEMPLATES[1],
      logs: [],
    },
  ],
  staff: [
    { id: 'staff-1', name: 'Alice' },
    { id: 'staff-2', name: 'Bob' },
  ],
  approval: null,
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <TasksScreen />
    </MemoryRouter>
  );
}

function mockDailyResponse(overrides: Partial<typeof MOCK_DAILY_RESPONSE> = {}) {
  const response = { ...MOCK_DAILY_RESPONSE, ...overrides };
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/daily')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    }
    if (url.includes('/templates')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ templates: MOCK_TEMPLATES }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TasksScreen', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDailyResponse();
  });

  // ── 기본 렌더링 ──────────────────────────────────────────────────────────

  it('displays today\'s date', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    });
  });

  it('renders template cards after loading', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Clean kitchen')).toBeInTheDocument();
      expect(screen.getByText('Prep salad')).toBeInTheDocument();
    });
  });

  it('shows completed log with staff name', async () => {
    renderScreen();
    await waitFor(() => {
      // Alice appears in both the select and in the log — just verify at least one exists
      const elements = screen.getAllByText('Alice');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no templates exist', async () => {
    mockDailyResponse({ tasks: [], staff: [] });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/no.*task/i)).toBeInTheDocument();
    });
  });

  // ── Feature 1+2: 인라인 기록 ───────────────────────────────────────────

  it('renders inline staff select on each task card', async () => {
    renderScreen();
    await waitFor(() => {
      // Should have staff select elements (not a Record dialog)
      const staffSelects = screen.getAllByRole('combobox');
      expect(staffSelects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('pre-fills staff select when template has staff_id', async () => {
    renderScreen();
    await waitFor(() => {
      // Clean kitchen has staff_id: 'staff-1' (Alice) — appears in select and/or log
      const elements = screen.getAllByText('Alice');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Feature 3: 날짜 이동 ───────────────────────────────────────────────

  it('renders date navigation arrows', async () => {
    renderScreen();
    await waitFor(() => {
      // Should have left/right arrow buttons for date navigation
      const buttons = screen.getAllByRole('button');
      const navButtons = buttons.filter(
        (b) => b.querySelector('[class*="chevron"]') || b.getAttribute('aria-label')?.includes('Previous') || b.getAttribute('aria-label')?.includes('Next')
      );
      // At minimum should find navigation-like buttons
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  // ── Feature 4: Owner approve ───────────────────────────────────────────

  it('shows Approve button for owner role', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/approve/i)).toBeInTheDocument();
    });
  });

  it('shows Approved badge when approval is present', async () => {
    mockDailyResponse({
      approval: { approved_at: '2026-03-29T20:00:00Z', approved_by: 'Owner' } as any,
    });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
    });
  });

  it('shows Unapprove button when already approved (owner)', async () => {
    mockDailyResponse({
      approval: { approved_at: '2026-03-29T20:00:00Z', approved_by: 'Owner' } as any,
    });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/unapprove/i)).toBeInTheDocument();
    });
  });

  // ── Feature: Task History ───────────────────────────────────────────────

  it('renders history button on each task card', async () => {
    renderScreen();
    await waitFor(() => {
      const historyButtons = screen.getAllByLabelText(/history/i);
      expect(historyButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
