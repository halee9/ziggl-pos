import React from 'react';
import { CornerUpLeft, Printer, Check, Info, X } from 'lucide-react';
import type { KDSOrder, OrderStatus } from '../types';
import { getItemDisplay, getModifierDisplay, mergeLineItems, formatElapsed, formatDuration, getElapsedMinutes } from '../utils';
import { useKDSStore } from '../stores/kdsStore';
import { useSessionStore } from '../stores/sessionStore';

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
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onPrint: (order: KDSOrder) => void;
}

// 소스 → 배지 색상 (OrderCard와 동일)
const SOURCE_VARIANT: Record<string, string> = {
  'DoorDash':      'bg-red-600 text-white',
  'Uber Eats':     'bg-green-700 text-white',
  'Grubhub':       'bg-orange-500 text-white',
  'Square Online': 'bg-purple-600 text-white',
  'Kiosk':         'bg-blue-600 text-white',
  'Unknown':       'bg-muted text-muted-foreground',
};

// 상태 → 주문번호 텍스트 색 (배경은 다크 그대로)
function badgeClass(status: OrderStatus) {
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

// ── 주문 상세 모달 ────────────────────────────────────────────────────────────
function OrderInfoModal({ order, onClose }: { order: KDSOrder; onClose: () => void }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 no-print"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl font-black text-foreground shrink-0">#{order.displayId}</span>
            <span className="text-lg font-semibold text-blue-300 truncate">{order.displayName}</span>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 ml-2 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 소스 · 상태 · 예약 시간 */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {order.source}
          </span>
          <span className="text-xs font-bold text-muted-foreground">{order.status}</span>
          {order.isScheduled && order.pickupAt && (
            <span className="text-xs font-bold text-yellow-400">
              📅 {new Date(order.pickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* 아이템 목록 (전체 — KDS 필터 없음) */}
        <div className="bg-muted/30 rounded-lg px-3 py-2 mb-3 space-y-1 max-h-48 overflow-y-auto">
          {mergeLineItems(order.lineItems).map((item, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-semibold text-foreground">
                ×{item.quantity} {item.name}
              </span>
              {item.variationName && (
                <span className="text-muted-foreground ml-1">({item.variationName})</span>
              )}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-xs text-muted-foreground ml-3">
                  {item.modifiers.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 메모 */}
        {order.note && (
          <div className="text-sm bg-yellow-900/40 text-yellow-200 border border-yellow-700/40 rounded px-2 py-1 italic mb-3">
            ★ {order.note}
          </div>
        )}

        {/* 타임스탬프 */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>Ordered: {fmt(order.createdAt)}</div>
          {order.startedAt  && <div>Started:  {fmt(order.startedAt)}</div>}
          {order.readyAt    && <div>Ready:    {fmt(order.readyAt)}</div>}
          {order.completedAt && <div>Done:    {fmt(order.completedAt)}</div>}
        </div>
      </div>
    </div>
  );
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
      className="relative flex items-stretch border-b border-white/20 transition-all"
    >
      {/* 긴급도 바 — 왼쪽 세로 색상 스트라이프 */}
      <div className={`w-1 self-stretch shrink-0 transition-colors duration-500 ${URGENCY_BAR[urgency]}`} />

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
                className="px-2.5 py-0.5 rounded-md text-4xl font-black leading-tight inline-flex items-center gap-1.5 transition-all select-none cursor-pointer"
                style={isDone
                  ? { backgroundColor: '#1f2937', color: '#6b7280' }
                  : { backgroundColor: display.bgColor, color: display.textColor }
                }
                onClick={(e) => handleItemClick(e, idx, qty)}
              >
                {isDone && <Check className="h-7 w-7 text-green-500 shrink-0" />}
                {display.label}
              </span>
              {qty > 1 && (
                isDone
                  ? <span className="text-3xl font-black leading-none tabular-nums text-white/25">
                      ×{qty}
                    </span>
                  : doneCount > 0
                    ? <span className="text-3xl font-black leading-none tabular-nums text-green-400">
                        {doneCount}/{qty}
                      </span>
                    : <span className="text-3xl font-black leading-none tabular-nums text-white">
                        ×{qty}
                      </span>
              )}
              {item.variationName && (
                <span className={`text-sm transition-colors ${isDone ? 'text-white/20' : 'text-white/40'}`}>
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
                        ? 'border-white/10 text-white/25'
                        : modDisplay.bgColor
                          ? ''
                          : 'border-white/30 text-white/70'
                    }`}
                    style={!isDone && modDisplay.bgColor
                      ? { borderColor: modDisplay.bgColor, color: modDisplay.bgColor }
                      : undefined
                    }
                  >
                    {modDisplay.label}
                  </span>
                );
              })}
            </div>
          );
        })}
        {order.note && (
          <div className="text-sm bg-yellow-900/40 text-yellow-200 border border-yellow-700/40 rounded px-2 py-1 italic">
            ★ {order.note}
          </div>
        )}
      </div>

      {/* 주문 상세 모달 */}
      {infoOpen && <OrderInfoModal order={order} onClose={() => setInfoOpen(false)} />}

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
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40 select-none">
      <div className="text-3xl mb-2">🍽️</div>
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

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function OrderList({ activeOrders, scheduledOrders, readyOrders, completedOrders, onUpdateStatus, onPrint }: Props) {
  const { activeTab } = useSessionStore();

  // ── Active 탭 ─────────────────────────────────────────────────────────────
  if (activeTab === 'active') {
    // startedAt/createdAt 오름차순 (오래된 주문 먼저)
    const sorted = [...activeOrders].sort((a, b) => {
      const ta = a.startedAt ?? a.createdAt;
      const tb = b.startedAt ?? b.createdAt;
      return ta.localeCompare(tb);
    });

    // Kiosk = 왼쪽, 나머지 (Online/Delivery) = 오른쪽
    // ※ 'Cash' source는 현재 OrderSource 타입에 없으므로 'Kiosk'만 좌측으로 분류
    const kioskOrders  = sorted.filter((o) => o.source === 'Kiosk');
    const onlineOrders = sorted.filter((o) => o.source !== 'Kiosk');

    return (
      <div className="flex flex-col sm:flex-row h-full min-h-0 overflow-hidden no-print">
        {/* 왼쪽: Kiosk / Cash */}
        <div className="flex-1 flex flex-col min-h-0 border-b sm:border-b-0 sm:border-r border-border">
          <ColumnHeader title="Kiosk / Cash" count={kioskOrders.length} />
          <div className="flex-1 overflow-y-auto min-h-0">
            {kioskOrders.length === 0
              ? <EmptyState label="No Kiosk Orders" />
              : kioskOrders.map((o) => (
                  <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
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
