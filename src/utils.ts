import type { OrderSource, OrderModifier, MenuDisplayItem, ModifierDisplayItem, OrderLineItem } from './types';

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
  if (name === 'online') return 'Online';
  if (name.includes('kiosk') || name.includes('point of sale') || name.includes('pos')) return 'Kiosk';
  return 'Unknown';
}

// ─── Menu Display 유틸 ───────────────────────────────────────────────────────

/** 메뉴 항목: 약어 + 배경색/글씨색 + POS 표시 여부 + 서버 경고 반환 */
export function getItemDisplay(
  itemName: string,
  menuDisplay: MenuDisplayItem[]
): { label: string; bgColor: string; textColor: string; showOnKds: boolean; serverAlert: boolean; icon?: string } {
  const config = menuDisplay.find(
    (m) => m.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || itemName,
    bgColor:     config?.bg_color     || '#F3F4F6',
    textColor:   config?.text_color   || '#111827',
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
    icon:        config?.icon,
  };
}

/** modifier를 정규화: string → { name, qty: 1, price: 0 }, object → 그대로 */
export function normalizeMod(mod: any): OrderModifier {
  if (typeof mod === 'string') return { name: mod, qty: 1, price: 0 };
  return {
    name: mod?.name ?? String(mod ?? ''),
    qty: mod?.qty ?? mod?.quantity ?? 1,
    price: Number(mod?.price ?? 0),
  };
}

/** 모디파이어: 약어 + 색상 + POS 표시 여부 + 서버 경고 반환 */
export function getModifierDisplay(
  mod: OrderModifier | string | any,
  modifierDisplay: ModifierDisplayItem[]
): { label: string; bgColor: string; textColor: string; showOnKds: boolean; serverAlert: boolean; icon?: string; qty: number; price: number } {
  const { name, qty, price } = normalizeMod(mod);
  const config = modifierDisplay.find(
    (m) => m.modifier_name.toLowerCase().trim() === name.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || name,
    bgColor:     config?.bg_color     || '',
    textColor:   config?.text_color   || '',
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
    icon:        config?.icon,
    qty,
    price,
  };
}

/**
 * 아이템 아이콘 + visible 모디파이어 아이콘들을 순서대로 수집.
 * 3개 KDS 컴포넌트(OrderList, OrderCard, ItemLabelPrinter)에서 재사용.
 */
export function collectLineItemIcons(
  item: OrderLineItem,
  menuItems: MenuDisplayItem[],
  modifierDisplay: ModifierDisplayItem[]
): string[] {
  const icons: string[] = [];
  const itemDisplay = getItemDisplay(item.name, menuItems);
  if (itemDisplay.icon) icons.push(itemDisplay.icon);
  for (const mod of item.modifiers ?? []) {
    const modDisplay = getModifierDisplay(mod, modifierDisplay);
    if (modDisplay.showOnKds && modDisplay.icon) icons.push(modDisplay.icon);
  }
  return icons;
}

/**
 * 이름 + variationName + 모디파이어 조합이 완전히 동일한 라인아이템을 병합.
 * 수량(quantity)과 금액(totalMoney)은 합산, 나머지 필드는 첫 항목 기준.
 */
export function mergeLineItems(items: OrderLineItem[]): OrderLineItem[] {
  const map = new Map<string, OrderLineItem>();

  for (const item of items) {
    // 모디파이어는 name+qty로 키 생성, 정렬해서 순서 차이를 무시
    const mods = (item.modifiers ?? []).map(normalizeMod);
    const modKey = [...mods].sort((a, b) => a.name.localeCompare(b.name)).map((m) => `${m.name}:${m.qty}`).join('\x00');
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
  'Online': 'bg-teal-600',
  'DoorDash': 'bg-red-600',
  'Uber Eats': 'bg-green-600',
  'Grubhub': 'bg-orange-500',
  'Square Online': 'bg-purple-600',
  'Unknown': 'bg-gray-600',
};
