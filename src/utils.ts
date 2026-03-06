import type { OrderSource, MenuDisplayItem, ModifierDisplayItem } from './types';

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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

/** 메뉴 항목: 약어 + 배경색/글씨색 반환 (설정 없으면 풀네임 + 기본 색상) */
export function getItemDisplay(
  itemName: string,
  menuDisplay: MenuDisplayItem[]
): { label: string; bgColor: string; textColor: string } {
  const config = menuDisplay.find(
    (m) => m.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
  );
  return {
    label:     config?.abbreviation || itemName,
    bgColor:   config?.bg_color     || '#F3F4F6',
    textColor: config?.text_color   || '#111827',
  };
}

/** 모디파이어: 약어 반환 (설정 없으면 원래 이름) */
export function getModifierDisplay(
  modifierName: string,
  modifierDisplay: ModifierDisplayItem[]
): string {
  const config = modifierDisplay.find(
    (m) => m.modifier_name.toLowerCase().trim() === modifierName.toLowerCase().trim()
  );
  return config?.abbreviation || modifierName;
}

export const SOURCE_COLORS: Record<OrderSource, string> = {
  'Kiosk': 'bg-blue-600',
  'DoorDash': 'bg-red-600',
  'Uber Eats': 'bg-green-600',
  'Grubhub': 'bg-orange-500',
  'Square Online': 'bg-purple-600',
  'Unknown': 'bg-gray-600',
};
