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

describe('TicketContent — bag fee display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Bag Fee" row with formatted amount when bagFee > 0', () => {
    renderTicket({ ...baseOrder, bagCount: 1, bagFee: 25, subtotal: 1500, taxAmount: 160 });
    expect(screen.getByText('Bag Fee')).toBeInTheDocument();
    expect(screen.getByText('$0.25')).toBeInTheDocument();
  });

  it('omits "Bag Fee" row when bagFee is 0', () => {
    renderTicket({ ...baseOrder, bagFee: 0, subtotal: 1500 });
    expect(screen.queryByText('Bag Fee')).not.toBeInTheDocument();
  });

  it('omits "Bag Fee" row when bagFee is undefined', () => {
    renderTicket({ ...baseOrder, subtotal: 1500 });
    expect(screen.queryByText('Bag Fee')).not.toBeInTheDocument();
  });
});
