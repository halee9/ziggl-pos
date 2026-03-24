import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Check, Undo2, Banknote, Calculator } from 'lucide-react';
import { useKDSStore } from '../stores/kdsStore';
import { formatMoney } from '../utils';
import CashTenderDialog from '../components/CashTenderDialog';
import OrderTicketModal from '../components/OrderTicketModal';
import type { KDSOrder } from '../types';

interface Props {
  onUpdateStatus: (orderId: string, status: KDSOrder['status']) => Promise<void>;
  onConfirmCash: (orderId: string, cashTendered?: number, cashChange?: number) => Promise<void>;
  onRejectCash: (orderId: string) => Promise<void>;
}

const sourceColor: Record<string, string> = {
  Kiosk: 'bg-green-600',
  Online: 'bg-blue-600',
  DoorDash: 'bg-red-600',
  'Uber Eats': 'bg-emerald-600',
  Grubhub: 'bg-orange-600',
};

export default function CashierScreen({ onUpdateStatus, onConfirmCash, onRejectCash }: Props) {
  const navigate = useNavigate();
  const orders = useKDSStore((s) => s.orders);
  const [selectedCashOrder, setSelectedCashOrder] = useState<KDSOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<KDSOrder | null>(null);

  const readyOrders = orders.filter((o) => o.status === 'READY');
  const cashDueOrders = orders.filter((o) => o.status === 'PENDING_PAYMENT');
  const completedOrders = orders
    .filter((o) => o.status === 'COMPLETED')
    .sort((a, b) => new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime())
    .slice(0, 20);

  const handlePickup = async (orderId: string) => {
    await onUpdateStatus(orderId, 'COMPLETED');
  };

  const handleReopen = async (orderId: string) => {
    await onUpdateStatus(orderId, 'READY');
  };

  const OrderRow = ({ order, action }: { order: KDSOrder; action: 'pickup' | 'cash' | 'reopen' }) => (
    <div
      className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
        action === 'reopen'
          ? 'opacity-60 hover:bg-secondary/50 cursor-pointer'
          : 'hover:bg-secondary/70 cursor-pointer'
      }`}
      onClick={() => {
        if (action === 'pickup') setDetailOrder(order);
        else if (action === 'cash') setSelectedCashOrder(order);
        else if (action === 'reopen') setDetailOrder(order);
      }}
    >
      {/* Top row: order info */}
      <div className="flex items-center gap-3">
        {/* Order number — clickable for pickup */}
        {action === 'pickup' ? (
          <button
            onClick={(e) => { e.stopPropagation(); handlePickup(order.id); }}
            className="text-lg font-bold w-10 text-center text-green-500 hover:bg-green-500/20 rounded-lg transition-colors py-1"
            title="Mark as picked up"
          >
            {order.displayId}
          </button>
        ) : (
          <span className="text-lg font-bold w-10 text-center text-foreground">{order.displayId}</span>
        )}
        <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${sourceColor[order.source] ?? 'bg-gray-600'}`}>
          {order.source}
        </span>
        <span className="font-medium text-sm flex-1 truncate">{order.displayName}</span>
        <span className="font-semibold text-sm">{formatMoney(order.totalMoney)}</span>
        {action === 'pickup' && <Check size={18} className="text-green-500" />}
        {action === 'cash' && <Banknote size={18} className="text-amber-500" />}
        {action === 'reopen' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleReopen(order.id); }}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Reopen"
          >
            <Undo2 size={14} />
          </button>
        )}
      </div>
      {/* Items row */}
      <div className="ml-13 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {order.lineItems.map((item, i) => (
          <span key={i}>
            {item.name}{Number(item.quantity) > 1 ? ` ×${item.quantity}` : ''}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Monitor size={20} className="text-primary" />
          <h1 className="text-lg font-bold">Counter</h1>
        </div>
        <button
          onClick={() => navigate('/cash')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <Calculator size={16} />
          Cash Count
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: READY orders (KDS card style) */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="text-base font-bold">Ready for Pickup</span>
            {readyOrders.length > 0 && (
              <span className="min-w-[24px] h-6 flex items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold px-2">
                {readyOrders.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
            {readyOrders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No orders ready
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border-2 border-green-500/40 bg-card p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setDetailOrder(order)}
                >
                  {/* Top: number + source + name */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-black text-green-500">#{order.displayId}</span>
                    <span className={`text-xs font-bold text-white px-2 py-0.5 rounded ${sourceColor[order.source] ?? 'bg-gray-600'}`}>
                      {order.source}
                    </span>
                    <span className="text-lg font-semibold flex-1 truncate">{order.displayName}</span>
                    <span className="text-lg font-bold">{formatMoney(order.totalMoney)}</span>
                  </div>
                  {/* Items */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-3">
                    {order.lineItems.map((item, i) => (
                      <span key={i}>
                        {item.name}{Number(item.quantity) > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                    ))}
                  </div>
                  {/* Pickup button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePickup(order.id); }}
                    className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-base font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check size={20} /> Picked Up
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Cash Due + Completed stacked naturally */}
        <div className="w-1/2 flex flex-col overflow-auto">
          {/* Cash Due */}
          {cashDueOrders.length > 0 && (
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <Banknote size={16} className="text-amber-500" />
                <span className="text-sm font-semibold">Cash Due</span>
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-1.5 animate-pulse">
                  {cashDueOrders.length}
                </span>
              </div>
              <div className="p-2 space-y-0.5">
                {cashDueOrders.map((order) => (
                  <OrderRow key={order.id} order={order} action="cash" />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedOrders.length > 0 && (
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-t border-border flex items-center gap-2">
                <Check size={16} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Completed</span>
                <span className="text-xs text-muted-foreground">{completedOrders.length}</span>
              </div>
              <div className="p-2 space-y-0.5">
                {completedOrders.map((order) => (
                  <OrderRow key={order.id} order={order} action="reopen" />
                ))}
              </div>
            </div>
          )}

          {/* Empty state when both are empty */}
          {cashDueOrders.length === 0 && completedOrders.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No cash or completed orders
            </div>
          )}
        </div>
      </div>

      {/* Cash Tendering Dialog */}
      <CashTenderDialog
        order={selectedCashOrder}
        open={!!selectedCashOrder}
        onClose={() => setSelectedCashOrder(null)}
        onConfirm={onConfirmCash}
        onReject={onRejectCash}
      />

      {/* Order Ticket Modal */}
      {detailOrder && (
        <OrderTicketModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
