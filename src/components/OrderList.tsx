import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, CornerUpLeft, Printer, Check, Info, Banknote, X, Inbox } from 'lucide-react';
import type { KDSOrder, OrderStatus } from '../types';
import { getItemDisplay, getModifierDisplay, mergeLineItems, formatElapsed, formatDuration, getElapsedMinutes } from '../utils';
import { useKDSStore } from '../stores/kdsStore';
import { useSessionStore } from '../stores/sessionStore';
import OrderTicketModal from './OrderTicketModal';

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
  onConfirmCash,
  onRejectCash,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
  onPrint: Props['onPrint'];
  onConfirmCash?: Props['onConfirmCash'];
  onRejectCash?: Props['onRejectCash'];
}) {
  const { menuDisplayConfig, urgencyYellowMin, urgencyOrangeMin, urgencyRedMin } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;

  const items = mergeLineItems(order.lineItems).filter(
    (item) => getItemDisplay(item.name, menuItems).showOnKds
  );

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
      className={`relative flex items-stretch border-b transition-all ${isPendingPayment ? 'border-amber-500/40 bg-amber-900/10' : 'border-border even:bg-muted/30'}`}
    >
      {/* 긴급도 바 — 왼쪽 세로 색상 스트라이프 */}
      <div className={`w-1 self-stretch shrink-0 transition-colors duration-500 ${isPendingPayment ? 'bg-amber-500' : URGENCY_BAR[urgency]}`} />

      {/* 주문번호 배지 — 클릭 시 상태 전진 */}
      <div
        className={`w-14 flex items-center justify-center shrink-0 cursor-pointer hover:brightness-125 transition-all ${badgeClass(order.status)}`}
        onClick={handleAdvance}
        title="Next status"
      >
        <span className="text-3xl font-black leading-none">
          {order.displayId}
        </span>
      </div>

      {/* 아이템 — 한 아이템당 한 줄, 옵션 인라인 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-3 py-1">
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
            <div key={idx} className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-md text-4xl font-black leading-tight inline-flex items-center gap-1.5 transition-all select-none cursor-pointer ${isDone ? 'bg-muted text-muted-foreground' : ''}`}
                style={isDone
                  ? undefined
                  : { backgroundColor: display.bgColor, color: display.textColor }
                }
                data-done={isDone || undefined}
                onClick={(e) => handleItemClick(e, idx, qty)}
              >
                {isDone && <Check className="h-7 w-7 text-green-500 shrink-0" />}
                {display.label}
              </span>
              {qty > 1 && (
                isDone
                  ? <span className="text-3xl font-black leading-none tabular-nums text-muted-foreground/40">
                      ×{qty}
                    </span>
                  : doneCount > 0
                    ? <span className="text-3xl font-black leading-none tabular-nums text-green-600 dark:text-green-400">
                        {doneCount}/{qty}
                      </span>
                    : <span className="text-3xl font-black leading-none tabular-nums text-foreground">
                        ×{qty}
                      </span>
              )}
              {item.variationName && (
                <span className={`text-sm transition-colors ${isDone ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
                  ({item.variationName})
                </span>
              )}
              {visibleMods.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifiers);
                return (
                  <span
                    key={mIdx}
                    className={`text-sm px-2 py-0.5 rounded border font-medium shrink-0 flex items-center gap-1 transition-all bg-transparent ${
                      isDone
                        ? 'border-border text-muted-foreground/30'
                        : modDisplay.bgColor
                          ? ''
                          : 'border-border text-foreground/70'
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
            </div>
          );
        })}
        {order.note && (
          <div className="text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700/40 rounded px-2 py-1 italic">
            ★ {order.note}
          </div>
        )}
        {isPendingPayment && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Banknote className="h-4 w-4" /> CASH — Collect ${((order.totalMoney ?? 0) / 100).toFixed(2)}
            </span>
            <button
              className="ml-auto text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); onRejectCash?.(order.id); }}
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white font-bold transition-colors flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); onConfirmCash?.(order.id); }}
            >
              <Banknote className="h-3 w-3" /> Cash Paid
            </button>
          </div>
        )}
      </div>

      {/* 주문 티켓 모달 */}
      {infoOpen && <OrderTicketModal order={order} onClose={() => setInfoOpen(false)} />}

      {/* 소스 · 고객 · 시간 · 프린트 · 정보 · 되돌리기 — 우측 상단 floating */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-2 pointer-events-none">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sourceBadge}`}>
          {order.source}
        </span>
        <span className="text-sm font-semibold text-blue-300 shrink-0">
          {order.displayName}
        </span>
        <span className={`text-sm font-bold tabular-nums shrink-0 transition-colors ${URGENCY_TIME[urgency]}${!isFinished && urgency === 3 ? ' animate-pulse' : ''}`}>
          {timeLabel}
        </span>
        <button
          className="no-print opacity-50 hover:opacity-90 transition-opacity pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); onPrint(order); }}
          title="Print ticket"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
        <button
          className="no-print opacity-50 hover:opacity-90 transition-opacity pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
          title="Order info"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {prevStatus(order.status) && (
          <button
            className="opacity-50 hover:opacity-100 transition-opacity pointer-events-auto"
            onClick={handleBack}
            title="Go back"
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
export default function OrderList({ activeOrders, scheduledOrders, readyOrders, completedOrders, cancelledOrders, onUpdateStatus, onPrint, onConfirmCash, onRejectCash }: Props) {
  const { activeTab } = useSessionStore();

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

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden no-print">
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* 왼쪽: Kiosk / Cash */}
          <div className="flex-1 flex flex-col min-h-0 border-b sm:border-b-0 sm:border-r border-border">
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
                    <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} onConfirmCash={onConfirmCash} onRejectCash={onRejectCash} />
                  ))
              }
            </div>
          </div>

          {/* 오른쪽: Pickup / Delivery */}
          <div className="flex-1 flex flex-col min-h-0">
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
        </div>

        {/* Scheduled 섹션 */}
        {sortedScheduled.length > 0 && (
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
