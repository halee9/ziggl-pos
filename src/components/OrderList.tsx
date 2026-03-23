import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, ChevronDown, ChevronRight, CornerUpLeft, Printer, Check, Info, Banknote, Inbox, Clock } from 'lucide-react';
import type { KDSOrder, OrderStatus } from '../types';
import { getItemDisplay, getModifierDisplay, mergeLineItems, formatElapsed, formatDuration, getElapsedMinutes } from '../utils';
import { useKDSStore } from '../stores/kdsStore';
import { useSessionStore } from '../stores/sessionStore';
import OrderTicketModal from './OrderTicketModal';

// ── useMediaQuery hook ──────────────────────────────────────────────────────
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// ── 경과 시간 긴급도 ───────────────────────────────────────────────────────
type Urgency = 0 | 1 | 2 | 3;

const URGENCY_BAR: Record<Urgency, string> = {
  0: 'bg-green-500',
  1: 'bg-yellow-400',
  2: 'bg-orange-400',
  3: 'bg-red-500',
};

const URGENCY_TIME: Record<Urgency, string> = {
  0: 'text-green-400',
  1: 'text-yellow-400',
  2: 'text-orange-400',
  3: 'text-red-400',
};

interface Props {
  activeOrders: KDSOrder[];
  scheduledOrders: KDSOrder[];   // OPEN + isScheduled (예약 대기)
  readyOrders: KDSOrder[];       // READY (픽업 대기)
  completedOrders: KDSOrder[];   // COMPLETED (완전 종료)
  cancelledOrders: KDSOrder[];   // CANCELED (취소)
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onPrint: (order: KDSOrder) => void;
  onConfirmCash?: (orderId: string) => void;
  onRejectCash?: (orderId: string) => void;
}

// 소스 → 배지 색상 (OrderCard와 동일)
const SOURCE_VARIANT: Record<string, string> = {
  'DoorDash':      'bg-red-600 text-white',
  'Uber Eats':     'bg-green-700 text-white',
  'Grubhub':       'bg-orange-500 text-white',
  'Square Online': 'bg-purple-600 text-white',
  'Online':        'bg-teal-600 text-white',
  'Kiosk':         'bg-blue-600 text-white',
  'Unknown':       'bg-muted text-muted-foreground',
};

// 상태 → 주문번호 텍스트 색 (배경은 다크 그대로)
function badgeClass(status: OrderStatus) {
  if (status === 'PENDING_PAYMENT') return 'text-amber-400';
  if (status === 'IN_PROGRESS') return 'text-yellow-400';
  if (status === 'READY')       return 'text-green-400';
  return 'text-red-400';
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

// ── 왼쪽 패널: 활성(IN_PROGRESS) 주문 큰 행 ──────────────────────────────────
function ActiveOrderRow({
  order,
  onUpdateStatus,
  onPrint,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
  onPrint: Props['onPrint'];
}) {
  const { menuDisplayConfig, urgencyYellowMin, urgencyOrangeMin, urgencyRedMin } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;

  const merged = mergeLineItems(order.lineItems);
  const visible = merged.filter(
    (item) => getItemDisplay(item.name, menuItems).showOnKds
  );
  // 전부 숨기면 빈 주문이 되므로, 그 경우 모두 표시
  const items = visible.length > 0 ? visible : merged;

  const sourceBadge = SOURCE_VARIANT[order.source] ?? SOURCE_VARIANT['Unknown'];

  // 시간 표시 & 긴급도 계산
  // - READY/COMPLETED: startedAt → readyAt 고정 소요시간 (prep 완료 후 정지)
  // - OPEN/IN_PROGRESS: startedAt → 지금(live)
  const startIso = order.startedAt ?? order.createdAt;
  const isFinished = order.status === 'READY' || order.status === 'COMPLETED';
  const endIso = order.readyAt ?? order.updatedAt;  // readyAt 없으면 updatedAt 폴백
  const urgencyMins = isFinished
    ? Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
    : getElapsedMinutes(startIso);
  const urgency: Urgency =
    urgencyMins >= urgencyRedMin    ? 3 :
    urgencyMins >= urgencyOrangeMin ? 2 :
    urgencyMins >= urgencyYellowMin ? 1 : 0;
  const timeLabel = isFinished
    ? formatDuration(startIso, endIso)
    : formatElapsed(startIso);

  // 아이템별 완료 카운트 (로컬) — idx → 완료된 수량
  const [doneCounts, setDoneCounts] = React.useState<Map<number, number>>(new Map());
  const [infoOpen, setInfoOpen] = React.useState(false);

  // 상태 복귀 시 리셋
  React.useEffect(() => {
    setDoneCounts(new Map());
  }, [order.id, order.status]);

  // 모든 아이템 수량 다 채워지면 → 600ms 후 auto-READY
  React.useEffect(() => {
    if (items.length === 0) return;
    const allDone = items.every(
      (item, idx) => (doneCounts.get(idx) ?? 0) >= Number(item.quantity)
    );
    if (!allDone) return;
    const timer = setTimeout(() => {
      onUpdateStatus(order.id, 'READY');
    }, 600);
    return () => clearTimeout(timer);
  }, [doneCounts, items, order.id, onUpdateStatus]);

  function handleItemClick(e: React.MouseEvent, idx: number, quantity: number) {
    e.stopPropagation();
    setDoneCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(idx) ?? 0;
      if (current >= quantity) {
        next.delete(idx); // 완료 상태에서 다시 클릭 → 리셋
      } else {
        next.set(idx, current + 1);
      }
      return next;
    });
  }

  function handleAdvance(e: React.MouseEvent) {
    e.stopPropagation();
    if (isPendingPayment) return; // Cash orders must be confirmed via Cash Paid button
    const next = nextStatus(order.status);
    if (next) onUpdateStatus(order.id, next);
  }

  function handleBack(e: React.MouseEvent) {
    e.stopPropagation();
    const prev = prevStatus(order.status);
    if (prev) onUpdateStatus(order.id, prev);
  }

  const isPendingPayment = order.status === 'PENDING_PAYMENT';

  return (
    <div
      className={`relative flex items-stretch border-b-2 transition-all ${isPendingPayment ? 'border-amber-500/40 bg-amber-900/10' : 'border-foreground/50 even:bg-muted/30'}`}
    >
      {/* 긴급도 바 — 왼쪽 세로 색상 스트라이프 */}
      <div className={`w-1 self-stretch shrink-0 transition-colors duration-500 ${isPendingPayment ? 'bg-amber-500' : URGENCY_BAR[urgency]}`} />

      {/* 주문번호 배지 — 클릭 시 상태 전진 */}
      <div
        className={`w-16 flex items-center justify-center shrink-0 cursor-pointer hover:brightness-125 transition-all ${badgeClass(order.status)}`}
        onClick={handleAdvance}
        title="Next status"
      >
        <span className="text-4xl font-black leading-none">
          {order.displayId}
        </span>
      </div>

      {/* 아이템 — 한 아이템당 한 줄, 옵션 인라인 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 px-3 py-1.5">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          const qty       = Number(item.quantity);
          const doneCount = doneCounts.get(idx) ?? 0;
          const isDone    = doneCount >= qty;
          const visibleMods = item.modifiers?.filter((mod) => {
            const modDisplay = getModifierDisplay(mod, modifiers);
            return modDisplay.showOnKds;
          }) ?? [];
          return (
            <div key={idx} className={`flex gap-1.5 flex-wrap ${idx === 0 ? 'items-end' : 'items-center'}`}>
              <span
                className={`px-3 py-0 rounded-md text-6xl font-black leading-none inline-flex items-center gap-1.5 transition-all select-none cursor-pointer ${isDone ? 'bg-muted text-muted-foreground' : ''}`}
                style={isDone
                  ? undefined
                  : { backgroundColor: display.bgColor, color: display.textColor }
                }
                data-done={isDone || undefined}
                onClick={(e) => handleItemClick(e, idx, qty)}
              >
                {isDone && <Check className="h-9 w-9 text-green-500 shrink-0" />}
                {display.label}
              </span>
              {qty > 1 && (
                isDone
                  ? <span className="text-4xl font-black leading-none tabular-nums text-muted-foreground/40">
                      ×{qty}
                    </span>
                  : doneCount > 0
                    ? <span className="text-4xl font-black leading-none tabular-nums text-green-600 dark:text-green-400">
                        {doneCount}/{qty}
                      </span>
                    : <span className="text-4xl font-black leading-none tabular-nums text-foreground">
                        ×{qty}
                      </span>
              )}
              {item.variationName && (
                <span className={`text-base transition-colors ${isDone ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
                  ({item.variationName})
                </span>
              )}
              {visibleMods.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifiers);
                return (
                  <span
                    key={mIdx}
                    className={`text-2xl px-2.5 py-0 rounded border-2 font-bold leading-none shrink-0 flex items-center gap-1 transition-all bg-transparent ${
                      isDone
                        ? 'border-muted-foreground/30 text-muted-foreground/30'
                        : modDisplay.bgColor
                          ? ''
                          : 'border-foreground/50 text-foreground'
                    }`}
                    style={!isDone && modDisplay.bgColor
                      ? { borderColor: modDisplay.bgColor, color: modDisplay.bgColor }
                      : undefined
                    }
                  >
                    {modDisplay.qty > 1 && <span className="font-bold">{modDisplay.qty}×</span>}
                    {modDisplay.label}
                  </span>
                );
              })}
              {item.note && (
                <span className="text-base text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/30 px-2 py-0.5 rounded italic">
                  "{item.note}"
                </span>
              )}
            </div>
          );
        })}
        {order.note && (
          <div className="text-lg bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700/40 rounded px-3 py-1.5 italic">
            ★ {order.note}
          </div>
        )}
        {isPendingPayment && (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Banknote className="h-5 w-5" /> CASH — Collect ${((order.totalMoney ?? 0) / 100).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* 주문 티켓 모달 */}
      {infoOpen && <OrderTicketModal order={order} onClose={() => setInfoOpen(false)} />}

      {/* 프린트 · 소스 · 인포 · 이름 · 시간 · 되돌리기 — 우측 상단 floating */}
      <div className="absolute top-2 right-2 flex items-center gap-3 pointer-events-none">
        <button
          className="no-print opacity-50 hover:opacity-90 transition-opacity pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); onPrint(order); }}
          title="Print ticket"
        >
          <Printer className="h-5 w-5" />
        </button>
        <span className={`font-bold px-2 py-0.5 rounded shrink-0 ${sourceBadge}`} style={{ fontSize: '16px' }}>
          {order.source}
        </span>
        {order.paymentMethod === 'CASH' && (
          <span className="text-base font-bold px-2 py-0.5 rounded shrink-0 bg-amber-600 text-white flex items-center gap-1">
            <Banknote className="h-4 w-4" /> CASH
          </span>
        )}
        {order.duplicateOf && (
          <span className="text-base font-bold px-2 py-0.5 rounded shrink-0 bg-red-600 text-white flex items-center gap-0.5 animate-pulse">
            <AlertTriangle className="h-4 w-4" /> Dup #{order.duplicateOf}
          </span>
        )}
        <button
          className="no-print opacity-50 hover:opacity-90 transition-opacity pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
          title="Order info"
        >
          <Info className="h-5 w-5" />
        </button>
        <span className="text-xl font-semibold text-blue-300 shrink-0">
          {order.displayName}
        </span>
        <span className={`text-xl font-bold tabular-nums shrink-0 transition-colors ${URGENCY_TIME[urgency]}${!isFinished && urgency === 3 ? ' animate-pulse' : ''}`}>
          {timeLabel}
        </span>
        {prevStatus(order.status) && (
          <button
            className="opacity-50 hover:opacity-100 transition-opacity pointer-events-auto"
            onClick={handleBack}
            title="Go back"
          >
            <CornerUpLeft className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── 3번째 칼럼용 Compact 주문 행 (Counter OrderRow 스타일) ───────────────────
function CompactOrderRow({
  order,
  onUpdateStatus,
  onPrint,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
  onPrint: Props['onPrint'];
}) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems } = menuDisplayConfig;

  const merged = mergeLineItems(order.lineItems);
  const visible = merged.filter((item) => getItemDisplay(item.name, menuItems).showOnKds);
  const items = visible.length > 0 ? visible : merged;

  const sourceBadge = SOURCE_VARIANT[order.source] ?? SOURCE_VARIANT['Unknown'];
  const isPendingPayment = order.status === 'PENDING_PAYMENT';
  const isScheduled = order.isScheduled && order.pickupAt;
  const [infoOpen, setInfoOpen] = React.useState(false);

  function handleAdvance(e: React.MouseEvent) {
    e.stopPropagation();
    if (isPendingPayment) return;
    const next = nextStatus(order.status);
    if (next) onUpdateStatus(order.id, next);
  }

  // pickupAt 포맷 (HH:MM)
  const pickupLabel = isScheduled
    ? new Date(order.pickupAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="w-full px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-secondary/70 cursor-pointer">
      {/* Top row: order info */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAdvance}
          className={`text-lg font-bold w-10 text-center rounded-lg transition-colors py-1 ${
            order.status === 'READY'
              ? 'text-green-500 hover:bg-green-500/20'
              : isPendingPayment
                ? 'text-amber-400'
                : 'text-foreground hover:bg-secondary'
          }`}
          title="Next status"
        >
          {order.displayId}
        </button>
        <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${sourceBadge}`}>
          {order.source}
        </span>
        <span className="font-medium text-sm flex-1 truncate">{order.displayName}</span>
        {isPendingPayment && (
          <span className="font-semibold text-sm text-amber-400">${((order.totalMoney ?? 0) / 100).toFixed(2)}</span>
        )}
        {pickupLabel && (
          <span className="text-xs font-bold text-purple-400 flex items-center gap-0.5">
            <Clock className="h-3 w-3" />{pickupLabel}
          </span>
        )}
        {order.status === 'READY' && <Check size={18} className="text-green-500" />}
        {isPendingPayment && <Banknote size={18} className="text-amber-500" />}
        <button
          className="opacity-40 hover:opacity-90 transition-opacity p-1"
          onClick={(e) => { e.stopPropagation(); onPrint(order); }}
          title="Print ticket"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
        <button
          className="opacity-40 hover:opacity-90 transition-opacity p-1"
          onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
          title="Order info"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {prevStatus(order.status) && (
          <button
            className="opacity-40 hover:opacity-90 transition-opacity p-1"
            onClick={(e) => {
              e.stopPropagation();
              const prev = prevStatus(order.status);
              if (prev) onUpdateStatus(order.id, prev);
            }}
            title="Go back"
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {/* Items row */}
      <div className="ml-13 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <span key={idx}>
              {display.label}{Number(item.quantity) > 1 ? ` ×${item.quantity}` : ''}
            </span>
          );
        })}
      </div>
      {order.note && (
        <div className="ml-13 mt-0.5 text-xs text-yellow-400 italic truncate">★ {order.note}</div>
      )}
      {infoOpen && <OrderTicketModal order={order} onClose={() => setInfoOpen(false)} />}
    </div>
  );
}

// ── Queue 섹션 헤더 ─────────────────────────────────────────────────────────
function QueueSectionHeader({ title, count, color, icon }: { title: string; count: number; color: string; icon?: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
      {icon}
      <span className={`text-sm font-semibold ${color}`}>{title}</span>
      <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-white text-xs font-bold px-1.5 ${
        color.includes('amber') ? 'bg-amber-500' : color.includes('purple') ? 'bg-purple-600' : 'bg-green-600'
      }`}>
        {count}
      </span>
    </div>
  );
}

// ── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/30 select-none">
      <Inbox className="h-8 w-8 mb-2" />
      <div className="text-xs">{label}</div>
    </div>
  );
}

// ── 컬럼 헤더 ────────────────────────────────────────────────────────────────
function ColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/20 shrink-0">
      <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">{title}</span>
      {count > 0 && (
        <span className="text-[10px] font-bold text-muted-foreground/60">({count})</span>
      )}
    </div>
  );
}

// ── Scheduled 접이식 섹션 ─────────────────────────────────────────────────────
function ScheduledSection({ orders, onUpdateStatus, onPrint }: {
  orders: KDSOrder[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onPrint: (order: KDSOrder) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t border-border shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-purple-900/15 hover:bg-purple-900/25 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-purple-400" /> : <ChevronRight className="h-3.5 w-3.5 text-purple-400" />}
        <Calendar className="h-3 w-3 text-purple-400" />
        <span className="text-[11px] font-bold text-purple-400 tracking-widest uppercase">Scheduled</span>
        <span className="text-[10px] font-bold text-muted-foreground/60">({orders.length})</span>
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto">
          {orders.map((o) => (
            <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function OrderList({ activeOrders, scheduledOrders, readyOrders, completedOrders, cancelledOrders, onUpdateStatus, onPrint }: Props) {
  const { activeTab } = useSessionStore();
  const isWide = useMediaQuery('(min-width: 1400px)');

  // ── Active 탭 ─────────────────────────────────────────────────────────────
  if (activeTab === 'active') {
    // PENDING_PAYMENT를 먼저 표시, 그 다음 오래된 주문 순
    const sorted = [...activeOrders].sort((a, b) => {
      const aIsPending = a.status === 'PENDING_PAYMENT' ? 0 : 1;
      const bIsPending = b.status === 'PENDING_PAYMENT' ? 0 : 1;
      if (aIsPending !== bIsPending) return aIsPending - bIsPending;
      const ta = a.startedAt ?? a.createdAt;
      const tb = b.startedAt ?? b.createdAt;
      return ta.localeCompare(tb);
    });

    // Kiosk = 왼쪽, 나머지 (Online/Delivery) = 오른쪽
    const kioskOrders  = sorted.filter((o) => o.source === 'Kiosk');
    const onlineOrders = sorted.filter((o) => o.source !== 'Kiosk');
    const pendingCashCount = kioskOrders.filter((o) => o.status === 'PENDING_PAYMENT').length;

    const sortedScheduled = [...scheduledOrders].sort((a, b) =>
      (a.pickupAt ?? '').localeCompare(b.pickupAt ?? '')
    );

    // Queue 칼럼용: Cash 미결제 (active 중 PENDING_PAYMENT)
    const pendingCashOrders = sorted.filter((o) => o.status === 'PENDING_PAYMENT');
    const sortedReady = [...readyOrders].sort((a, b) =>
      (a.readyAt ?? a.createdAt).localeCompare(b.readyAt ?? b.createdAt)
    );

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden no-print">
        <div className={`flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden`}>
          {/* 왼쪽: Kiosk / Cash */}
          <div className={`flex flex-col min-h-0 border-b sm:border-b-0 sm:border-r border-border ${isWide ? 'w-[40%]' : 'flex-1'}`}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/20 shrink-0">
              <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Kiosk / Cash</span>
              {kioskOrders.length > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground/60">({kioskOrders.length})</span>
              )}
              {pendingCashCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black">{pendingCashCount} cash</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {kioskOrders.length === 0
                ? <EmptyState label="No Kiosk Orders" />
                : kioskOrders.map((o) => (
                    <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                  ))
              }
            </div>
          </div>

          {/* 가운데: Pickup / Delivery */}
          <div className={`flex flex-col min-h-0 ${isWide ? 'w-[40%] border-r border-border' : 'flex-1'}`}>
            <ColumnHeader title="Pickup / Delivery" count={onlineOrders.length} />
            <div className="flex-1 overflow-y-auto min-h-0">
              {onlineOrders.length === 0
                ? <EmptyState label="No Pickup / Delivery Orders" />
                : onlineOrders.map((o) => (
                    <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                  ))
              }
            </div>
          </div>

          {/* 오른쪽: Queue (wide screen only) */}
          {isWide && (
            <div className="w-[20%] flex flex-col min-h-0 overflow-hidden">
              <ColumnHeader title="Queue" count={pendingCashOrders.length + sortedScheduled.length + sortedReady.length} />
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Cash 미결제 */}
                <QueueSectionHeader title="Cash Due" count={pendingCashOrders.length} color="text-amber-400" icon={<Banknote size={16} className="text-amber-500" />} />
                {pendingCashOrders.length > 0 && (
                  <div className="p-2 space-y-0.5">
                    {pendingCashOrders.map((o) => (
                      <CompactOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                    ))}
                  </div>
                )}

                {/* Scheduled */}
                <QueueSectionHeader title="Scheduled" count={sortedScheduled.length} color="text-purple-400" icon={<Calendar size={16} className="text-purple-400" />} />
                {sortedScheduled.length > 0 && (
                  <div className="p-2 space-y-0.5">
                    {sortedScheduled.map((o) => (
                      <CompactOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                    ))}
                  </div>
                )}

                {/* Ready */}
                <QueueSectionHeader title="Ready" count={sortedReady.length} color="text-green-400" icon={<Check size={16} className="text-green-500" />} />
                {sortedReady.length > 0 && (
                  <div className="p-2 space-y-0.5">
                    {sortedReady.map((o) => (
                      <CompactOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                    ))}
                  </div>
                )}

                {pendingCashOrders.length + sortedScheduled.length + sortedReady.length === 0 && (
                  <EmptyState label="No Queued Orders" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scheduled 섹션 (narrow screen only) */}
        {!isWide && sortedScheduled.length > 0 && (
          <ScheduledSection orders={sortedScheduled} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
        )}
      </div>
    );
  }

  // ── Scheduled 탭 ──────────────────────────────────────────────────────────
  if (activeTab === 'scheduled') {
    const sorted = [...scheduledOrders].sort((a, b) =>
      (a.pickupAt ?? '').localeCompare(b.pickupAt ?? '')
    );

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden no-print">
        <div className="flex-1 overflow-y-auto min-h-0">
          {sorted.length === 0
            ? <EmptyState label="No Scheduled Orders" />
            : sorted.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
          }
        </div>
      </div>
    );
  }

  // ── Cancelled 탭 ──────────────────────────────────────────────────────────
  if (activeTab === 'cancelled') {
    const sorted = [...cancelledOrders].sort((a, b) =>
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
    );

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden no-print">
        <ColumnHeader title="Cancelled Orders" count={sorted.length} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {sorted.length === 0
            ? <EmptyState label="No Cancelled Orders" />
            : sorted.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
          }
        </div>
      </div>
    );
  }

  // ── Ready·Done 탭 ─────────────────────────────────────────────────────────
  const sortedReady = [...readyOrders].sort((a, b) =>
    (a.readyAt ?? a.createdAt).localeCompare(b.readyAt ?? b.createdAt)
  );
  const sortedDone = [...completedOrders].sort((a, b) =>
    (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)
  );

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0 overflow-hidden no-print">
      {/* 왼쪽: READY */}
      <div className="flex-1 flex flex-col min-h-0 border-b sm:border-b-0 sm:border-r border-border">
        <ColumnHeader title="Ready" count={sortedReady.length} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {sortedReady.length === 0
            ? <EmptyState label="No Ready Orders" />
            : sortedReady.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
          }
        </div>
      </div>

      {/* 오른쪽: COMPLETED */}
      <div className="flex-1 flex flex-col min-h-0">
        <ColumnHeader title="Done" count={sortedDone.length} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {sortedDone.length === 0
            ? <EmptyState label="No Completed Orders" />
            : sortedDone.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
          }
        </div>
      </div>
    </div>
  );
}
