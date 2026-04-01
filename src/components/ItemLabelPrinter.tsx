import { useRef, useState, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import type { KDSOrder, OrderModifier } from '../types';
import { normalizeMod, formatMoney, collectLineItemIcons } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface ExpandedItem {
  name: string;
  variationName?: string;
  modifiers?: OrderModifier[];
  note?: string;
}

/** Expand each line item by its quantity (qty=2 → 2 label entries) */
function expandItems(lineItems: KDSOrder['lineItems']): ExpandedItem[] {
  const result: ExpandedItem[] = [];
  lineItems.forEach((item) => {
    const qty = parseInt(item.quantity, 10) || 1;
    for (let i = 0; i < qty; i++) {
      result.push({
        name: item.name,
        variationName: item.variationName,
        modifiers: (item.modifiers ?? []).map(normalizeMod),
        note: item.note,
      });
    }
  });
  return result;
}

interface Props {
  order: KDSOrder;
  className?: string;
}

/**
 * "Print Items" button — sequentially prints one sticker label per item×qty.
 * Each label: ORDER #displayId + item name + variation + modifiers.
 * Uses react-to-print (isolated iframe per print job).
 */
export function PrintAllItemsButton({ order, className }: Props) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;
  const items = expandItems(order.lineItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintCurrent = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order.displayId}-Item-${currentIndex + 1}`,
    onAfterPrint: () => {
      if (currentIndex < items.length - 1) {
        // Small delay before advancing to next label
        setTimeout(() => setCurrentIndex((i) => i + 1), 500);
      } else {
        // All done
        setCurrentIndex(0);
        setIsPrinting(false);
      }
    },
  });

  // Memoize to avoid stale closure in useEffect
  const printCurrent = useCallback(handlePrintCurrent, [handlePrintCurrent]);

  // Auto-trigger print when isPrinting state advances to a new index
  useEffect(() => {
    if (isPrinting && currentIndex < items.length) {
      const timer = setTimeout(printCurrent, 200);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isPrinting, items.length, printCurrent]);

  const handlePrintAll = () => {
    if (items.length === 0) return;
    setCurrentIndex(0);
    setIsPrinting(true);
  };

  return (
    <>
      <button
        onClick={handlePrintAll}
        disabled={isPrinting || items.length === 0}
        className={`flex items-center justify-center gap-1.5 py-2 bg-black text-white font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${className ?? 'flex-1'}`}
      >
        <Printer className="h-4 w-4" />
        {isPrinting ? `Printing ${currentIndex + 1}/${items.length}…` : 'Print Items'}
      </button>

      {/* Hidden label content — react-to-print reads this ref */}
      <div className="hidden">
        <div ref={printRef}>
          {items[currentIndex] && (
            <div
              className="p-4 font-mono text-black bg-white text-center"
              style={{ width: 280 }}
            >
              {/* Order number */}
              <div className="text-lg font-bold mb-4">
                ORDER #{order.displayId}
              </div>

              {/* Icons (item + modifier) */}
              {(() => {
                const cur = items[currentIndex];
                const icons = collectLineItemIcons(
                  { name: cur.name, quantity: '1', totalMoney: 0, modifiers: cur.modifiers },
                  menuItems, modifierDisplay
                );
                return icons.length > 0 ? (
                  <div className="text-4xl mb-1">{icons.join('')}</div>
                ) : null;
              })()}

              {/* Item name */}
              <div className="text-2xl font-bold mb-2">
                {items[currentIndex].name}
              </div>

              {/* Variation */}
              {items[currentIndex].variationName && (
                <div className="text-lg mb-1">
                  {items[currentIndex].variationName}
                </div>
              )}

              {/* Modifiers */}
              {items[currentIndex].modifiers?.map((m, i) => (
                <div key={i} className="text-lg">
                  {m.qty > 1 ? `${m.qty}× ` : ''}{m.name}
                  {m.price > 0 && <span className="text-sm ml-1">{formatMoney(m.price * m.qty)}</span>}
                </div>
              ))}

              {/* Item note */}
              {items[currentIndex].note && (
                <div className="text-base italic mt-2 border-t border-dashed border-gray-400 pt-2">
                  ★ {items[currentIndex].note}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
