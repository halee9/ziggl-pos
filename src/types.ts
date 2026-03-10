export type OrderSource = 'Kiosk' | 'DoorDash' | 'Uber Eats' | 'Grubhub' | 'Square Online' | 'Unknown';

// ─── Menu Display ─────────────────────────────────────────────────────────────

export interface MenuDisplayItem {
  id?: string;
  restaurant_code: string;
  square_item_id?: string;
  item_name: string;
  abbreviation?: string;
  bg_color?: string;
  text_color?: string;
  show_on_kds?: boolean;  // false면 KDS 화면에서 숨김 (default: true)
  server_alert?: boolean; // true면 출력 티켓 하단에 확인 요망 표시 (default: false)
}

export interface ModifierDisplayItem {
  id?: string;
  restaurant_code: string;
  square_modifier_id?: string;
  modifier_name: string;
  abbreviation?: string;
  bg_color?: string;      // 배지 배경색 (hex)
  text_color?: string;    // 배지 텍스트색 (hex)
  show_on_kds?: boolean;  // false면 KDS 화면에서 숨김 (default: true)
  server_alert?: boolean; // true면 출력 티켓 하단에 확인 요망 표시 (default: false)
}

export interface MenuDisplayConfig {
  menuItems: MenuDisplayItem[];
  modifiers: ModifierDisplayItem[];
}

export type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELED';

export interface OrderLineItem {
  name: string;
  quantity: string;
  variationName?: string;
  modifiers?: string[];
  totalMoney: number; // cents
}

export interface KDSOrder {
  id: string;
  displayId: string;
  source: OrderSource;
  status: OrderStatus;
  isDelivery: boolean;
  isScheduled: boolean;
  displayName: string;
  pickupAt: string;
  lineItems: OrderLineItem[];
  totalMoney: number; // cents
  note?: string;
  deliveryNote?: string;  // 배달 앱 배달 지시 (DoorDash/Uber Eats/Grubhub)
  subtotal?: number;    // cents (optional — not all order sources provide it)
  tax?: number;         // cents
  createdAt: string;
  updatedAt: string;
  startedAt?: string;    // IN_PROGRESS로 처음 전환된 시각
  readyAt?: string;      // READY로 처음 전환된 시각
  completedAt?: string;  // COMPLETED로 처음 전환된 시각
}
