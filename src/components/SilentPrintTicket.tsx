import { useRef, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { KDSOrder } from '../types';
import { useKDSStore } from '../stores/kdsStore';
import { TicketContent } from './OrderTicketModal';

interface Props {
  order: KDSOrder;
  /** "auto" = autoPrint(IN_PROGRESS 진입), "manual" = 프린터 아이콘 클릭 */
  source: 'auto' | 'manual';
  onDone: () => void;
}

/**
 * Invisible component — auto-triggers a full ticket print on mount via react-to-print.
 * Used for auto-print (order → IN_PROGRESS) and direct print icon click.
 * Calls onDone() after print completes (or if print dialog is cancelled).
 */
export default function SilentPrintTicket({ order, source, onDone }: Props) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;
  const printRef = useRef<HTMLDivElement>(null);

  const doneRef = useRef(false);
  const safeDone = useCallback(() => {
    if (!doneRef.current) { doneRef.current = true; onDone(); }
  }, [onDone]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order.displayId}`,
    onAfterPrint: safeDone,
  });

  const triggerPrint = useCallback(handlePrint, [handlePrint]);

  useEffect(() => {
    const timer = setTimeout(triggerPrint, 100);
    // 안전장치: 5초 내 프린트 완료 안 되면 큐에서 제거
    const fallback = setTimeout(safeDone, 5000);
    return () => { clearTimeout(timer); clearTimeout(fallback); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hidden">
      <div ref={printRef}>
        <div className="p-5 font-mono text-black bg-white text-sm" style={{ width: 280 }}>
          <TicketContent order={order} menuItems={menuItems} modifiers={modifiers} printSource={source} />
        </div>
      </div>
    </div>
  );
}
