import React from 'react';
import { CornerUpLeft, Printer, Check } from 'lucide-react';
import type { KDSOrder, OrderStatus } from '../types';
import { getItemDisplay, getModifierDisplay, mergeLineItems, formatElapsed, getElapsedMinutes } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

// ── 경과 시간 긴급도 ───────────────────────────────────────────────────────
type Urgency = 0 | 1 | 2 | 3;

function getUrgency(
  isoString: string,
  yellow: number,
  orange: number,
  red: number,
): Urgency {
  const mins = getElapsedMinutes(isoString);
  if (mins >= red)    return 3;
  if (mins >= orange) return 2;
  if (mins >= yellow) return 1;
  return 0;
}

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
  3: 'text-red-400 animate-pulse',
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

  // 긴급도 — startedAt 기준 (없으면 createdAt 폴백), 임계값은 store에서
  const urgency = getUrgency(
    order.startedAt ?? order.createdAt,
    urgencyYellowMin,
    urgencyOrangeMin,
    urgencyRedMin,
  );

  // 아이템별 완료 카운트 (로컬) — idx → 완료된 수량
  const [doneCounts, setDoneCounts] = React.useState<Map<number, number>>(new Map());

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

      {/* 소스 · 고객 · 시간 · 프린트 · 되돌리기 — 우측 상단 floating */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-2 pointer-events-none">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sourceBadge}`}>
          {order.source}
        </span>
        <span className="text-sm font-semibold text-blue-300 shrink-0">
          {order.displayName}
        </span>
        <span className={`text-sm font-bold tabular-nums shrink-0 transition-colors ${URGENCY_TIME[urgency]}`}>
          {formatElapsed(order.startedAt ?? order.createdAt)}
        </span>
        <button
          className="no-print opacity-50 hover:opacity-90 transition-opacity pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); onPrint(order); }}
          title="Print ticket"
        >
          <Printer className="h-3.5 w-3.5" />
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

// ── 오른쪽 패널 상단: 미시작(OPEN) 주문 compact 행 ───────────────────────────
function IncomingOrderRow({
  order,
  onUpdateStatus,
}: {
  order: KDSOrder;
  onUpdateStatus: Props['onUpdateStatus'];
}) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems } = menuDisplayConfig;

  const items = mergeLineItems(order.lineItems).filter(
    (item) => getItemDisplay(item.name, menuItems).showOnKds
  );

  const sourceBadge = SOURCE_VARIANT[order.source] ?? SOURCE_VARIANT['Unknown'];

  // 예약 주문: 픽업 시간 표시
  const timeLabel = order.isScheduled && order.pickupAt
    ? new Date(order.pickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'NOW';

  return (
    <div
      className="flex items-center border-b border-white/15 min-h-[2rem] cursor-pointer hover:brightness-110 transition-all bg-muted/30"
      onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
    >
      {/* 주문번호 — 제일 왼쪽 */}
      <span className="w-8 pl-1.5 font-black text-xs shrink-0 text-muted-foreground">
        {order.displayId}
      </span>

      {/* 소스 배지 */}
      <span className={`text-[9px] font-bold px-1 py-0.5 mr-1.5 rounded shrink-0 ${sourceBadge}`}>
        {order.source}
      </span>

      {/* 아이템 나열 */}
      <div className="flex-1 flex items-center gap-1.5 px-1 overflow-hidden">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <span key={idx} className="text-xs font-bold whitespace-nowrap" style={{ color: display.textColor }}>
              {Number(item.quantity) > 1 && <span className="mr-0.5">{item.quantity}</span>}
              {display.label}
            </span>
          );
        })}
      </div>

      {/* 고객 + 시간 */}
      <div className="text-xs text-right px-1.5 shrink-0">
        <span className="font-semibold mr-1">{order.displayName}</span>
        <span className={`font-bold ${order.isScheduled ? 'text-yellow-400' : 'text-orange-400'}`}>
          {timeLabel}
        </span>
      </div>
    </div>
  );
}

// ── 오른쪽 패널 하단: 완료(READY/COMPLETED) 주문 compact 행 ─────────────────
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

  const isReady = order.status === 'READY';

  return (
    <div
      className={`flex items-center border-b border-white/10 transition-all ${isReady ? '' : 'opacity-35'}`}
    >
      {/* 주문번호 — READY면 클릭 시 COMPLETED 전진 */}
      <span
        className={`w-9 pl-1.5 font-black text-sm shrink-0 ${isReady ? 'text-green-400 cursor-pointer hover:brightness-125' : 'text-white/30'}`}
        onClick={() => isReady && onUpdateStatus(order.id, 'COMPLETED')}
        title={isReady ? 'Mark as Completed' : undefined}
      >
        {order.displayId}
      </span>

      {/* 상태 점 */}
      <span className={`text-[10px] pr-1 shrink-0 ${isReady ? 'text-green-400' : 'text-white/25'}`}>
        ●
      </span>

      {/* 아이템 인라인 — 카테고리 색 텍스트 */}
      <div className="flex-1 flex items-center gap-1.5 px-1 py-1 overflow-hidden flex-wrap">
        {items.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <span key={idx} className="text-sm font-bold whitespace-nowrap flex items-center gap-0.5 opacity-70"
                  style={{ color: display.bgColor }}>
              {display.label}
              {Number(item.quantity) > 1 && (
                <span className="ml-1 text-white/80 font-black tabular-nums">×{item.quantity}</span>
              )}
              {item.modifiers?.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifiers);
                if (!modDisplay.showOnKds) return null;
                return (
                  <span key={mIdx} className="text-xs font-normal text-white/35 ml-0.5">
                    {modDisplay.label}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>

      {/* 고객 + 시간 */}
      <div className="text-xs text-right px-1.5 shrink-0 leading-tight">
        <div className="font-semibold text-white/60 truncate">{order.displayName}</div>
        <div className="text-white/35 tabular-nums">{formatElapsed(order.createdAt)}</div>
      </div>

      {/* 되돌리기 버튼 */}
      <button
        className="w-7 shrink-0 flex items-center justify-center opacity-20 hover:opacity-70 transition-opacity self-stretch"
        onClick={() => {
          const prev = prevStatus(order.status);
          if (prev) onUpdateStatus(order.id, prev);
        }}
        title="Undo"
      >
        <CornerUpLeft className="h-3.5 w-3.5" />
      </button>
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
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40 select-none">
      <div className="text-3xl mb-2">🍽️</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function OrderList({ activeOrders, scheduledOrders, readyOrders, completedOrders, onUpdateStatus, onPrint }: Props) {
  // IN_PROGRESS 전환 시각 순 정렬 (오래된 것 먼저)
  const sortedActive = [...activeOrders].sort((a, b) => {
    const ta = a.startedAt ?? a.createdAt;
    const tb = b.startedAt ?? b.createdAt;
    return ta.localeCompare(tb);
  });

  return (
    <div className="flex h-full min-h-0 overflow-hidden no-print">

      {/* ── 왼쪽 패널: 활성 주문 ──────────────────────── */}
      <div className="flex-[65] border-r border-border min-w-0 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          {sortedActive.length === 0
            ? <EmptyState label="No Active Orders" />
            : sortedActive.map((o) => (
                <ActiveOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              ))
          }
        </div>
      </div>

      {/* ── 오른쪽 패널 ───────────────────────────────────────── */}
      <div className="flex-[35] overflow-y-auto min-w-0 flex flex-col">

        {/* 상단: SCHEDULED (예약 대기 주문) */}
        {scheduledOrders.length > 0 && (
          <>
            <SectionHeader title="SCHEDULED" />
            {scheduledOrders.map((o) => (
              <IncomingOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
            ))}
          </>
        )}

        {/* 중단: READY (픽업 대기) */}
        {readyOrders.length > 0 && (
          <>
            <SectionHeader title="READY" />
            {readyOrders.map((o) => (
              <DoneOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
            ))}
          </>
        )}

        {/* 하단: COMPLETED */}
        {completedOrders.length > 0 && (
          <>
            <SectionHeader title="COMPLETED" />
            {completedOrders.map((o) => (
              <DoneOrderRow key={o.id} order={o} onUpdateStatus={onUpdateStatus} />
            ))}
          </>
        )}

        {/* 아무것도 없을 때 */}
        {scheduledOrders.length === 0 && readyOrders.length === 0 && completedOrders.length === 0 && (
          <EmptyState label="No Orders" />
        )}
      </div>
    </div>
  );
}
