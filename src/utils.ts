import type { OrderSource, MenuDisplayItem, ModifierDisplayItem, OrderLineItem } from './types';

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function getElapsedMinutes(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
}

export function formatElapsed(isoString: string): string {
  const mins = getElapsedMinutes(isoString);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** 두 고정 timestamp 사이의 소요시간 포맷 (준비 완료 주문 표시용) */
export function formatDuration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function detectSource(squareSourceName?: string): OrderSource {
  if (!squareSourceName) return 'Unknown';
  const name = squareSourceName.toLowerCase();
  if (name.includes('doordash')) return 'DoorDash';
  if (name.includes('uber')) return 'Uber Eats';
  if (name.includes('grubhub')) return 'Grubhub';
  if (name.includes('square online') || name.includes('online store')) return 'Square Online';
  if (name.includes('kiosk') || name.includes('point of sale') || name.includes('pos')) return 'Kiosk';
  return 'Unknown';
}

// ─── Menu Display 유틸 ───────────────────────────────────────────────────────

/** 메뉴 항목: 약어 + 배경색/글씨색 + KDS 표시 여부 + 서버 경고 반환 */
export function getItemDisplay(
  itemName: string,
  menuDisplay: MenuDisplayItem[]
): { label: string; bgColor: string; textColor: string; showOnKds: boolean; serverAlert: boolean } {
  const config = menuDisplay.find(
    (m) => m.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || itemName,
    bgColor:     config?.bg_color     || '#F3F4F6',
    textColor:   config?.text_color   || '#111827',
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
  };
}

/** 모디파이어: 약어 + 색상 + KDS 표시 여부 + 서버 경고 반환 */
export function getModifierDisplay(
  modifierName: string,
  modifierDisplay: ModifierDisplayItem[]
): { label: string; bgColor: string; textColor: string; showOnKds: boolean; serverAlert: boolean } {
  const config = modifierDisplay.find(
    (m) => m.modifier_name.toLowerCase().trim() === modifierName.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || modifierName,
    bgColor:     config?.bg_color     || '',
    textColor:   config?.text_color   || '',
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
  };
}

/**
 * 이름 + variationName + 모디파이어 조합이 완전히 동일한 라인아이템을 병합.
 * 수량(quantity)과 금액(totalMoney)은 합산, 나머지 필드는 첫 항목 기준.
 */
export function mergeLineItems(items: OrderLineItem[]): OrderLineItem[] {
  const map = new Map<string, OrderLineItem>();

  for (const item of items) {
    // 모디파이어는 정렬해서 순서 차이를 무시
    const modKey = [...(item.modifiers ?? [])].sort().join('\x00');
    const key = `${item.name}\x00${item.variationName ?? ''}\x00${modKey}`;

    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        quantity:   String(Number(existing.quantity) + Number(item.quantity)),
        totalMoney: existing.totalMoney + item.totalMoney,
      });
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
}

export const SOURCE_COLORS: Record<OrderSource, string> = {
  'Kiosk': 'bg-blue-600',
  'DoorDash': 'bg-red-600',
  'Uber Eats': 'bg-green-600',
  'Grubhub': 'bg-orange-500',
  'Square Online': 'bg-purple-600',
  'Unknown': 'bg-gray-600',
};
