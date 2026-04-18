import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketContent } from '../components/OrderTicketModal';
import type { KDSOrder } from '../types';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <div data-testid="qr-code" />,
}));

vi.mock('../stores/kdsStore', () => ({
  useKDSStore: vi.fn(),
}));

vi.mock('../components/ItemLabelPrinter', () => ({
  PrintAllItemsButton: () => null,
}));

const baseOrder: KDSOrder = {
  id: 'order-1',
  displayId: 'K-001',
  source: 'Kiosk',
  status: 'OPEN',
  isDelivery: false,
  isScheduled: false,
  displayName: 'John',
  pickupAt: '',
  lineItems: [],
  totalMoney: 1500,
  createdAt: '2026-04-17T12:00:00Z',
  updatedAt: '2026-04-17T12:00:00Z',
};

function renderTicket(order: KDSOrder) {
  return render(<TicketContent order={order} menuItems={[]} modifiers={[]} />);
}

describe('TicketContent — bag count display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No Bags" when bagCount is 0', () => {
    renderTicket({ ...baseOrder, bagCount: 0 });
    expect(screen.getByText('No Bags')).toBeInTheDocument();
  });

  it('shows "No Bags" when bagCount is undefined', () => {
    renderTicket({ ...baseOrder });
    expect(screen.getByText('No Bags')).toBeInTheDocument();
  });

  it('shows "1 Bag" when bagCount is 1', () => {
    renderTicket({ ...baseOrder, bagCount: 1 });
    expect(screen.getByText('1 Bag')).toBeInTheDocument();
    expect(screen.queryByText('No Bags')).not.toBeInTheDocument();
  });

  it('shows "2 Bags" when bagCount is 2', () => {
    renderTicket({ ...baseOrder, bagCount: 2 });
    expect(screen.getByText('2 Bags')).toBeInTheDocument();
    expect(screen.queryByText('No Bags')).not.toBeInTheDocument();
  });
});
