// ─── Restaurant Config ───────────────────────────────────────────────────────

export interface RestaurantConfig {
  id: string;
  restaurant_code: string;
  name: string;
  square_location_id: string;
  square_environment: string;
  tax_rate: number;
  tip_percentages: number[];
  settings_pin: string;
  enable_tipping: boolean;
  session_timeout_minutes: number;
  logo_style?: string;
  pay_period_start?: string | null;
  timezone?: string;
  hours?: { open: string; close: string; days: number[] } | null;
  theme?: {
    primaryColor: string;
    accentColor?: string;
    bgColor?: string;
    textColor?: string;
    logoUrl?: string;
    heroImageUrl?: string;
    fontFamily?: string;
  } | null;
  enable_landing?: boolean;
  enable_cash_payment?: boolean;
  enable_coin_counting?: boolean;
  manager_pin?: string | null;
  staff_pin?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  social_links?: {
    instagram?: string;
    facebook?: string;
    yelp?: string;
    google_maps?: string;
  } | null;
}

// ─── Order Types ─────────────────────────────────────────────────────────────

export type OrderSource = 'Kiosk' | 'Online' | 'DoorDash' | 'Uber Eats' | 'Grubhub' | 'Square Online' | 'Unknown';
export type PosRole = 'staff' | 'manager' | 'owner';

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
  sold_out?: boolean;     // true면 품절 표시 (default: false)
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

export type OrderStatus = 'PENDING_PAYMENT' | 'OPEN' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELED';

export interface OrderModifier {
  name: string;
  qty: number;
  price: number; // cents (modifier 단가)
}

export interface OrderLineItem {
  name: string;
  quantity: string;
  variationName?: string;
  modifiers?: OrderModifier[];
  totalMoney: number; // cents
  note?: string;
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
  paymentMethod?: string;  // 'CARD' | 'CASH'
  note?: string;
  deliveryNote?: string;  // 배달 앱 배달 지시 (DoorDash/Uber Eats/Grubhub)
  subtotal?: number;    // cents (optional — not all order sources provide it)
  tax?: number;         // cents
  createdAt: string;
  updatedAt: string;
  paymentSource?: string;  // 'stripe' | 'square' | 'cash'
  cardBrand?: string;      // 'VISA' | 'MASTERCARD' | 'AMERICAN_EXPRESS' | ...
  cardLast4?: string;      // '4242'
  duplicateOf?: string;    // 중복 주문인 경우, 원본 주문의 displayId
  refundedAt?: string;     // 환불된 시각
  flag?: string[] | null;
  photos?: { url: string; uploaded_at: string }[];
  startedAt?: string;    // IN_PROGRESS로 처음 전환된 시각
  readyAt?: string;      // READY로 처음 전환된 시각
  completedAt?: string;  // COMPLETED로 처음 전환된 시각
}
