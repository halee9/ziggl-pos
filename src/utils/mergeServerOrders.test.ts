import { describe, it, expect } from 'vitest';
import type { KDSOrder, OrderStatus } from '../types';
import { mergeServerOrders } from './mergeServerOrders';

function mkOrder(id: string, status: OrderStatus, extra: Partial<KDSOrder> = {}): KDSOrder {
  return {
    id,
    displayId: id,
    source: 'Kiosk',
    status,
    isDelivery: false,
    isScheduled: false,
    displayName: id,
    pickupAt: '',
    lineItems: [],
    totalMoney: 0,
    subtotal: 0,
    tax: 0,
    taxAmount: 0,
    tipAmount: 0,
    paymentMethod: null,
    note: '',
    createdAt: '2026-04-23T00:00:00Z',
    updatedAt: '2026-04-23T00:00:00Z',
    ...extra,
  } as KDSOrder;
}

describe('mergeServerOrders', () => {
  it('preserves local order when local status is more advanced (forward-only)', () => {
    const local = [mkOrder('a', 'READY', { readyAt: '2026-04-23T01:00:00Z' })];
    const server = [mkOrder('a', 'IN_PROGRESS')]; // stale snapshot
    const merged = mergeServerOrders(server, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('READY');
    expect(merged[0].readyAt).toBe('2026-04-23T01:00:00Z');
  });

  it('uses server data when server status is more advanced', () => {
    const local = [mkOrder('a', 'IN_PROGRESS')];
    const server = [mkOrder('a', 'READY', { readyAt: '2026-04-23T02:00:00Z' })];
    const merged = mergeServerOrders(server, local);
    expect(merged[0].status).toBe('READY');
    expect(merged[0].readyAt).toBe('2026-04-23T02:00:00Z');
  });

  it('uses server data when statuses are equal (newer fields like cardBrand reflected)', () => {
    const local = [mkOrder('a', 'IN_PROGRESS')];
    const server = [mkOrder('a', 'IN_PROGRESS', { cardBrand: 'VISA', cardLast4: '4242' })];
    const merged = mergeServerOrders(server, local);
    expect(merged[0].cardBrand).toBe('VISA');
    expect(merged[0].cardLast4).toBe('4242');
  });

  it('CANCELED from server overrides any local status', () => {
    const local = [mkOrder('a', 'READY')];
    const server = [mkOrder('a', 'CANCELED')];
    const merged = mergeServerOrders(server, local);
    expect(merged[0].status).toBe('CANCELED');
  });

  it('local-only orders are appended (not in server response)', () => {
    const local = [mkOrder('a', 'READY'), mkOrder('b', 'OPEN')];
    const server = [mkOrder('a', 'READY')];
    const merged = mergeServerOrders(server, local);
    expect(merged).toHaveLength(2);
    expect(merged.find((o) => o.id === 'b')?.status).toBe('OPEN');
  });

  it('server-only orders are added (new orders from other clients)', () => {
    const local: KDSOrder[] = [];
    const server = [mkOrder('a', 'OPEN')];
    const merged = mergeServerOrders(server, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
  });

  it('preserves local COMPLETED when server returns IN_PROGRESS', () => {
    const local = [mkOrder('a', 'COMPLETED', { completedAt: '2026-04-23T03:00:00Z' })];
    const server = [mkOrder('a', 'IN_PROGRESS')];
    const merged = mergeServerOrders(server, local);
    expect(merged[0].status).toBe('COMPLETED');
    expect(merged[0].completedAt).toBe('2026-04-23T03:00:00Z');
  });

  it('handles multiple orders with mixed merge outcomes', () => {
    const local = [
      mkOrder('a', 'READY'),         // local more advanced
      mkOrder('b', 'OPEN'),          // local behind
      mkOrder('c', 'IN_PROGRESS'),   // local-only
    ];
    const server = [
      mkOrder('a', 'IN_PROGRESS'),   // stale → local kept
      mkOrder('b', 'READY'),         // newer → server used
      mkOrder('d', 'OPEN'),          // server-only → added
    ];
    const merged = mergeServerOrders(server, local);
    expect(merged).toHaveLength(4);
    expect(merged.find((o) => o.id === 'a')?.status).toBe('READY');
    expect(merged.find((o) => o.id === 'b')?.status).toBe('READY');
    expect(merged.find((o) => o.id === 'c')?.status).toBe('IN_PROGRESS');
    expect(merged.find((o) => o.id === 'd')?.status).toBe('OPEN');
  });
});
