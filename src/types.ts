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
}

export interface ModifierDisplayItem {
  id?: string;
  restaurant_code: string;
  square_modifier_id?: string;
  modifier_name: string;
  abbreviation?: string;
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
  createdAt: string;
  updatedAt: string;
}
