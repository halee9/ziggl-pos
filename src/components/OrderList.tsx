import { CornerUpLeft, AlertTriangle, Printer } from 'lucide-react';
import type { KDSOrder, OrderStatus } from '../types';
import { getItemDisplay, getModifierDisplay, mergeLineItems, formatElapsed } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface Props {
  activeOrders: KDSOrder[];
  doneOrders: KDSOrder[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onPrint: (order: KDSOrder) => void;
}

// 소스 → 단일 문자
const SOURCE_INITIAL: Record<string, string> = {
  'Kiosk':         'K',
  'DoorDash':      'D',
  'Uber Eats':     'U',
  'Grubhub':       'G',
  'Square Online': 'O',
  'Unknown':       '?',
};

// 상태 → 주문번호 배지 색
function badgeClass(status: OrderStatus) {
  if (status === 'IN_PROGRESS') return 'bg-yellow-500 text-black';
  if (status === 'READY')       return 'bg-green-600 text-white';
  return 'bg-red-600 text-white';
}

// 상태 전진
function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'OPEN')        return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'READY';
  if (status === 'READY')       return 'COMPLETED';
  return null;
}

// 상태 후진
function prevStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'IN_PROGRESS') return 'OPEN';
  if (status === 'READY')       return 'IN_PROGRESS';
  if (status === 'COMPLETED')   return 'READY';
  return null;
}

// ── 왼쪽 패널: 활성 주문 큰 행 ─────────────────────────────────────────────
function ActiveOrderRow({
  order,
  onUpdateStatus,
  onPrint,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
  onPrint: Props['onPrint'];
}) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;

  const items = mergeLineItems(order.lineItems).filter(
    (item) => getItemDisplay(item.name, menuItems).showOnKds
  );

  const sourceInitial = SOURCE_INITIAL[order.source] ?? '?';

  function handleAdvance(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('[data-badge]')) return;
    const next = nextStatus(order.status);
    if (next) onUpdateStatus(order.id, next);
  }

  function handleBack(e: React.MouseEvent) {
    e.stopPropagation();
    const prev = prevStatus(order.status);
    if (prev) onUpdateStatus(order.id, prev);
  }

  return (
    <div
      className="flex border-b border-border/40 cursor-pointer hover:brightness-110 transition-all"
      onClick={handleAdvance}
    >
      {/* 소스 컬럼 */}
      <div className="w-14 flex items-center justify-center text-5xl font-black bg-black/25 shrink-0 self-stretch select-none">
        {sourceInitial}
      </div>

      {/* 아이템 컬럼 */}
      <div className="flex-1 min-w-0">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 min-h-[3.5rem] flex-wrap"
              style={{ backgroundColor: display.bgColor }}
            >
              {Number(item.quantity) > 1 && (
                <span className="text-4xl font-black leading-none" style={{ color: display.textColor }}>
                  {item.quantity}
                </span>
              )}
              <span className="text-4xl font-black leading-none" style={{ color: display.textColor }}>
                {display.label}
              </span>
              {display.serverAlert && (
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              {item.modifiers?.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifiers);
                if (!modDisplay.showOnKds) return null;
                return (
                  <span key={mIdx} className="text-sm bg-white/80 text-black px-2 py-0.5 rounded border border-black/10 font-medium shrink-0 flex items-center gap-1">
                    +{modDisplay.label}
                    {modDisplay.serverAlert && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  </span>
                );
              })}
              {item.variationName && (
                <span className="text-sm text-black/50">({item.variationName})</span>
              )}
            </div>
          );
        })}
        {order.note && (
          <div className="px-3 py-1 text-sm bg-yellow-100/20 text-yellow-200 italic">
            ★ {order.note}
          </div>
        )}
      </div>

      {/* 고객 + 시간 */}
      <div className="w-28 flex flex-col items-end justify-center px-2 shrink-0 self-stretch bg-black/10 gap-0.5">
        <span className="text-sm font-semibold text-blue-300 truncate max-w-full text-right">
          {order.displayName}
        </span>
        <span className="text-sm text-orange-300 font-bold">
          {formatElapsed(order.createdAt)}
        </span>
        <button
          className="mt-1 no-print opacity-40 hover:opacity-80 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onPrint(order); }}
          title="Print"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 주문번호 배지 */}
      <div
        data-badge="true"
        className={`w-16 flex flex-col items-center justify-center shrink-0 self-stretch gap-1 ${badgeClass(order.status)}`}
      >
        {prevStatus(order.status) && (
          <button
            className="opacity-60 hover:opacity-100 transition-opacity"
            onClick={handleBack}
            title="Go back"
          >
            <CornerUpLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-3xl font-black leading-none">
          {order.displayId}
        </span>
      </div>
    </div>
  );
}

// ── 오른쪽 패널: 완료 주문 compact 행 ────────────────────────────────────────
function DoneOrderRow({
  order,
  onUpdateStatus,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
}) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;

  const items = mergeLineItems(order.lineItems).filter(
    (item) => getItemDisplay(item.name, menuItems).showOnKds
  );

  const firstColor = items[0] ? getItemDisplay(items[0].name, menuItems).bgColor : '#374151';
  const sourceInitial = SOURCE_INITIAL[order.source] ?? '?';

  return (
    <div
      className="flex items-center border-b border-border/20 min-h-[2.25rem]"
      style={{ backgroundColor: firstColor + 'bb' }}
    >
      {/* 소스 */}
      <span className="w-7 text-xs font-black text-center shrink-0 self-stretch flex items-center justify-center bg-black/20">
        {sourceInitial}
      </span>

      {/* 아이템 인라인 */}
      <div className="flex-1 flex items-center gap-2 px-2 py-1 overflow-hidden flex-wrap">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <span key={idx} className="text-sm font-bold whitespace-nowrap flex items-center gap-0.5"
                  style={{ color: display.textColor }}>
              {Number(item.quantity) > 1 && <span className="mr-0.5">{item.quantity}</span>}
              {display.label}
              {item.modifiers?.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifiers);
                if (!modDisplay.showOnKds) return null;
                return (
                  <span key={mIdx} className="text-xs font-normal opacity-70 ml-0.5">
                    +{modDisplay.label}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>

      {/* 고객 + 시간 */}
      <div className="text-xs text-right px-1 shrink-0 leading-tight min-w-[4.5rem]">
        <div className="font-semibold truncate">{order.displayName}</div>
        <div className="opacity-60">{formatElapsed(order.createdAt)}</div>
      </div>

      {/* 되돌리기 버튼 */}
      <button
        className="w-7 shrink-0 flex items-center justify-center opacity-30 hover:opacity-80 transition-opacity self-stretch"
        onClick={() => onUpdateStatus(order.id, 'READY')}
        title="Undo complete"
      >
        <CornerUpLeft className="h-3.5 w-3.5" />
      </button>

      {/* 주문번호 */}
      <span className="w-9 text-right pr-1.5 font-black text-sm shrink-0">
        {order.displayId}
      </span>
    </div>
  );
}

// ── 섹션 헤더 ─────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-center text-xs font-bold text-muted-foreground tracking-widest py-1.5 border-b border-border/50 bg-muted/10">
      {title}
    </div>
  );
}

// ── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 select-none">
      <div className="text-4xl mb-2">🍽️</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function OrderList({ activeOrders, doneOrders, onUpdateStatus, onPrint }: Props) {
  const { sectionSeparation } = useKDSStore();

  const inStoreOrders = activeOrders.filter((o) => o.source === 'Kiosk');
  const pickupOrders  = activeOrders.filter((o) => o.source !== 'Kiosk');

  return (
    <div className="flex h-full min-h-0 overflow-hidden no-print">

      {/* ── 왼쪽 패널: 활성 주문 ─────────────────────────── */}
      <div className="flex-[65] border-r border-border overflow-y-auto min-w-0">
        {sectionSeparation ? (
          <>
            <SectionHeader title="IN-STORE ORDERS" />
            {inStoreOrders.length === 0
              ? <EmptyState label="No In-Store Orders" />
              : inStoreOrders.map((o) => (
                  <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                ))
            }
            <SectionHeader title="PICKUP & DELIVERY ORDERS" />
            {pickupOrders.length === 0
              ? <EmptyState label="No Pickup & Delivery Orders" />
              : pickupOrders.map((o) => (
                  <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                ))
            }
          </>
        ) : (
          activeOrders.length === 0
            ? <EmptyState label="No Active Orders" />
            : activeOrders.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
        )}
      </div>

      {/* ── 오른쪽 패널: 완료 주문 ───────────────────────── */}
      <div className="flex-[35] overflow-y-auto min-w-0">
        <SectionHeader title="COMPLETED ORDERS" />
        {doneOrders.length === 0
          ? <EmptyState label="No Completed Orders" />
          : doneOrders.map((o) => (
              <DoneOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
            ))
        }
      </div>
    </div>
  );
}
