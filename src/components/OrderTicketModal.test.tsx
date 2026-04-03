import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketContent } from './OrderTicketModal';
import type { KDSOrder, MenuDisplayItem, ModifierDisplayItem } from '../types';

const makeOrder = (overrides: Partial<KDSOrder> = {}): KDSOrder => ({
  id: 'order-1',
  displayId: '119',
  source: 'Kiosk',
  status: 'OPEN',
  isDelivery: false,
  isScheduled: false,
  displayName: 'Test Customer',
  pickupAt: '',
  lineItems: [],
  totalMoney: 4641,
  createdAt: '2026-04-03T12:47:00Z',
  updatedAt: '2026-04-03T12:47:00Z',
  ...overrides,
});

describe('TicketContent CONFIRM alerts', () => {
  const modifiers: ModifierDisplayItem[] = [
    { restaurant_code: 'TEST', modifier_name: 'Side Rice', abbreviation: 'ExRice', server_alert: true },
    { restaurant_code: 'TEST', modifier_name: 'Sprite', abbreviation: 'Sprite', server_alert: true },
    { restaurant_code: 'TEST', modifier_name: 'Dr Pepper', abbreviation: 'Dr Pepper', server_alert: true },
  ];
  const menuItems: MenuDisplayItem[] = [];

  it('multiplies modifier qty by item quantity for alert count', () => {
    const order = makeOrder({
      lineItems: [
        {
          name: 'Chicken Teriyaki',
          quantity: '2',
          totalMoney: 3798,
          modifiers: [{ name: 'Side Rice', qty: 2, price: 150 }],
        },
        {
          name: 'Sprite',
          quantity: '1',
          totalMoney: 200,
          modifiers: [],
        },
      ],
    });

    render(<TicketContent order={order} menuItems={menuItems} modifiers={modifiers} />);

    // 2 Chicken Teriyaki × 2 Side Rice = 4 ExRice
    expect(screen.getByText('4 ExRice')).toBeTruthy();
  });

  it('sums modifier alerts across multiple line items', () => {
    const order = makeOrder({
      lineItems: [
        {
          name: 'Chicken Teriyaki',
          quantity: '1',
          totalMoney: 1899,
          modifiers: [{ name: 'Side Rice', qty: 1, price: 150 }],
        },
        {
          name: 'Beef Teriyaki',
          quantity: '3',
          totalMoney: 5997,
          modifiers: [{ name: 'Side Rice', qty: 2, price: 150 }],
        },
      ],
    });

    render(<TicketContent order={order} menuItems={menuItems} modifiers={modifiers} />);

    // 1×1 + 3×2 = 7 ExRice
    expect(screen.getByText('7 ExRice')).toBeTruthy();
  });

  it('shows correct count for single-quantity item with modifier qty > 1', () => {
    const order = makeOrder({
      lineItems: [
        {
          name: 'Chicken Teriyaki',
          quantity: '1',
          totalMoney: 1899,
          modifiers: [{ name: 'Side Rice', qty: 3, price: 150 }],
        },
      ],
    });

    render(<TicketContent order={order} menuItems={menuItems} modifiers={modifiers} />);

    // 1 × 3 = 3 ExRice
    expect(screen.getByText('3 ExRice')).toBeTruthy();
  });
});
