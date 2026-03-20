import QRCode from 'react-qr-code';
import { X, XCircle } from 'lucide-react';
import type { KDSOrder, MenuDisplayItem, ModifierDisplayItem } from '../types';
import { formatMoney, formatDateTime, getItemDisplay, getModifierDisplay, normalizeMod } from '../utils';
import { useKDSStore } from '../stores/kdsStore';
import { PrintAllItemsButton } from './ItemLabelPrinter';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface Props {
  order: KDSOrder;
  onClose: () => void;
}

/** Shared ticket content — exported so SilentPrintTicket can reuse it */
export function TicketContent({ order, menuItems, modifiers: modifierList }: {
  order: KDSOrder;
  menuItems: MenuDisplayItem[];
  modifiers: ModifierDisplayItem[];
}) {
  // Collect server-alert items/modifiers as "count → label" map
  const alertMap = new Map<string, number>();
  order.lineItems.forEach((item) => {
    const d = getItemDisplay(item.name, menuItems);
    if (d.serverAlert) {
      const qty = parseInt(item.quantity, 10) || 1;
      alertMap.set(d.label, (alertMap.get(d.label) ?? 0) + qty);
    }
    (item.modifiers ?? []).forEach((mod) => {
      const md = getModifierDisplay(mod, modifierList);
      if (md.serverAlert) {
        alertMap.set(md.label, (alertMap.get(md.label) ?? 0) + md.qty);
      }
    });
  });

  const orderType = `${order.source} ${order.isDelivery ? 'Delivery' : 'Pickup'}`;

  return (
    <div className="w-full">
      {/* ── Header ── */}
      <p className="text-base text-center">{orderType}</p>
      <p className="text-3xl font-bold text-center leading-tight mt-0.5">{order.displayName || '—'}</p>
      <div className="text-xs text-center mt-1 space-y-0.5">
        <p>Order at {formatDateTime(order.createdAt)}</p>
        {order.pickupAt && <p>Pickup at {formatDateTime(order.pickupAt)}</p>}
      </div>

      <hr className="border-black my-2" />

      {/* ── Order number + QR ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-7xl font-bold leading-none">{order.displayId}</p>
          <p className="text-sm text-center mt-1">No Bags</p>
        </div>
        <QRCode value={`${SERVER_URL}/receipt/${order.id}`} size={120} />
      </div>

      <hr className="border-black my-2" />

      {/* ── Line items ── */}
      <div className="space-y-1.5">
        {order.lineItems.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between font-bold leading-snug">
              <span className="mr-2">
                {item.quantity !== '1' ? `${item.quantity} ` : ''}{item.name}
              </span>
              <span className="shrink-0">{formatMoney(item.totalMoney)}</span>
            </div>
            {item.variationName && (
              <div className="ml-3 text-xs text-gray-700">{item.variationName}</div>
            )}
            {item.modifiers?.map((m, i) => {
              const mod = normalizeMod(m);
              return (
                <div key={i} className="ml-3 text-xs text-gray-700 flex justify-between">
                  <span>{mod.qty > 1 ? `${mod.qty}× ` : ''}{mod.name}</span>
                  {mod.price > 0 && <span className="shrink-0">{formatMoney(mod.price * mod.qty)}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <hr className="border-black my-2" />

      {/* ── Totals ── */}
      <div className="space-y-0.5 text-sm">
        {order.subtotal != null && (
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
        )}
        {order.tax != null && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatMoney(order.tax)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>{formatMoney(order.totalMoney)}</span>
        </div>
      </div>

      {/* ── Server alerts ── */}
      {alertMap.size > 0 && (
        <>
          <hr className="border-black border-dashed my-2" />
          <p className="font-bold">⚠ CONFIRM:</p>
          {[...alertMap.entries()].map(([label, count]) => (
            <p key={label} className="font-black text-lg leading-tight">{count} {label}</p>
          ))}
        </>
      )}

      {/* ── Note ── */}
      {order.note && (
        <>
          <hr className="border-black my-2" />
          <p className="font-bold">NOTE: {order.note}</p>
        </>
      )}

      {/* ── Delivery Note ── */}
      {order.deliveryNote && (
        <>
          <hr className="border-black my-2" />
          <p className="font-bold text-gray-500">DELIVERY: {order.deliveryNote}</p>
        </>
      )}
    </div>
  );
}

export default function OrderTicketModal({ order, onClose }: Props) {
  const { cancelOrder, menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers } = menuDisplayConfig;

  const handleCancel = () => {
    cancelOrder(order.id);
    onClose();
  };

  return (
    <>
      {/* ── On-screen modal (hidden during print) ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:hidden">
        <div className="relative bg-white text-black font-mono text-sm rounded shadow-2xl w-72 max-h-[90vh] flex flex-col">

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-black transition-colors z-10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Scrollable ticket body */}
          <div className="overflow-y-auto p-5 pr-6">
            <TicketContent order={order} menuItems={menuItems} modifiers={modifiers} />
          </div>

          {/* Action buttons (sticky at bottom) */}
          <div className="border-t border-gray-200 p-3 flex gap-2 shrink-0">
            <PrintAllItemsButton order={order} />
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-black font-bold rounded text-sm hover:bg-gray-100 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
