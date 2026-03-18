import { useState } from 'react';
import type { KDSOrder, OrderStatus } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Clock, CreditCard, User, Package,
  ChefHat, CheckCircle2, XCircle,
  ArrowRight, Undo2,
} from 'lucide-react';

interface Props {
  order: KDSOrder | null;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onRefund?: (orderId: string) => Promise<void>;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0) return '-';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    PENDING_PAYMENT: { label: 'Cash Due', className: 'bg-amber-600/20 text-amber-500 border-amber-600/30' },
    OPEN:        { label: 'Open',        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    IN_PROGRESS: { label: 'In Progress', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    READY:       { label: 'Ready',       className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    COMPLETED:   { label: 'Completed',   className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    CANCELED:    { label: 'Canceled',    className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const s = map[status] ?? map.OPEN;
  return <Badge variant="outline" className={`text-sm ${s.className}`}>{s.label}</Badge>;
}

// 다음 상태 버튼들
function getNextActions(status: OrderStatus): { label: string; icon: React.ReactNode; nextStatus: OrderStatus; variant: 'default' | 'outline' | 'destructive' }[] {
  switch (status) {
    case 'OPEN':
      return [
        { label: 'Start', icon: <ChefHat size={14} />, nextStatus: 'IN_PROGRESS', variant: 'default' },
        { label: 'Cancel', icon: <XCircle size={14} />, nextStatus: 'CANCELED', variant: 'destructive' },
      ];
    case 'IN_PROGRESS':
      return [
        { label: 'Ready', icon: <CheckCircle2 size={14} />, nextStatus: 'READY', variant: 'default' },
        { label: 'Cancel', icon: <XCircle size={14} />, nextStatus: 'CANCELED', variant: 'destructive' },
      ];
    case 'READY':
      return [
        { label: 'Complete', icon: <Package size={14} />, nextStatus: 'COMPLETED', variant: 'default' },
      ];
    case 'COMPLETED':
      return [
        { label: 'Recall', icon: <ArrowRight size={14} />, nextStatus: 'READY', variant: 'outline' },
      ];
    case 'CANCELED':
      return [
        { label: 'Reopen', icon: <ArrowRight size={14} />, nextStatus: 'OPEN', variant: 'outline' },
      ];
    default:
      return [];
  }
}

export default function OrderDetailPanel({ order, onClose, onStatusChange, onRefund }: Props) {
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);

  if (!order) return null;

  const actions = getNextActions(order.status);
  const canRefund = onRefund && ['OPEN', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELED'].includes(order.status) && !order.refundedAt;

  const handleRefund = async () => {
    if (!onRefund) return;
    setRefunding(true);
    try {
      await onRefund(order.id);
      setRefundConfirmOpen(false);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setRefunding(false);
    }
  };

  const timeline = [
    { label: 'Created', time: order.createdAt, icon: <Clock size={12} /> },
    { label: 'Started', time: order.startedAt, icon: <ChefHat size={12} /> },
    { label: 'Ready', time: order.readyAt, icon: <CheckCircle2 size={12} /> },
    { label: 'Completed', time: order.completedAt, icon: <Package size={12} /> },
    ...(order.refundedAt ? [{ label: 'Refunded', time: order.refundedAt, icon: <Undo2 size={12} /> }] : []),
  ];

  return (
    <Sheet open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background border-l border-border">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <span className="font-mono">#{order.displayId}</span>
              {statusBadge(order.status)}
            </SheetTitle>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              order.source === 'Kiosk' ? 'bg-purple-500/20 text-purple-400' :
              order.source === 'Online' ? 'bg-cyan-500/20 text-cyan-400' :
              'bg-muted text-muted-foreground'
            }`}>
              {order.source}
            </span>
            {order.isScheduled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                Scheduled
              </span>
            )}
            {order.isDelivery && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                Delivery
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Actions */}
        {(actions.length > 0 || canRefund || order.refundedAt) && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {actions.map((action) => (
                <Button
                  key={action.nextStatus}
                  variant={action.variant}
                  size="sm"
                  onClick={() => onStatusChange(order.id, action.nextStatus)}
                  className="flex items-center gap-1"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              {canRefund && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRefundConfirmOpen(true)}
                  className="flex items-center gap-1"
                >
                  <Undo2 size={14} />
                  Refund
                </Button>
              )}
              {order.refundedAt && (
                <Badge variant="outline" className="text-sm bg-red-500/20 text-red-400 border-red-500/30">
                  Refunded
                </Badge>
              )}
            </div>
            <Separator className="mb-4" />
          </>
        )}

        {/* Refund Confirmation Dialog */}
        <Dialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Refund</DialogTitle>
              <DialogDescription>
                Refund {formatMoney(order.totalMoney)} for order #{order.displayId}? This will reverse the payment and cancel the order.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRefundConfirmOpen(false)} disabled={refunding}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRefund} disabled={refunding}>
                {refunding ? 'Processing...' : 'Refund'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Info */}
        <section className="mb-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <User size={12} /> Customer
          </h3>
          <div className="text-sm">
            <p className="font-medium">{order.displayName || 'Guest'}</p>
            {order.isScheduled && order.pickupAt && (
              <p className="text-muted-foreground text-xs mt-1">
                Pickup: {formatDateTime(order.pickupAt)}
              </p>
            )}
          </div>
        </section>

        <Separator className="mb-4" />

        {/* Line Items */}
        <section className="mb-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Items ({order.lineItems.reduce((sum, li) => sum + parseInt(li.quantity || '1'), 0)})
          </h3>
          <div className="space-y-2">
            {order.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1">
                    <span className="text-muted-foreground font-mono text-xs mt-0.5">
                      {item.quantity}x
                    </span>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.variationName && (
                        <p className="text-xs text-muted-foreground">{item.variationName}</p>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.modifiers.map((mod, j) => (
                            <span key={j} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {mod.name}
                              {mod.price > 0 && ` +${formatMoney(mod.price)}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-muted-foreground ml-2 whitespace-nowrap">
                  {formatMoney(item.totalMoney)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Separator className="mb-4" />

        {/* Price Breakdown */}
        <section className="mb-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <CreditCard size={12} /> Payment
          </h3>
          <div className="space-y-1 text-sm">
            {order.subtotal != null && order.subtotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
            )}
            {order.tax != null && order.tax > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span>{formatMoney(order.totalMoney)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {(order.note || order.deliveryNote) && (
          <>
            <Separator className="mb-4" />
            <section className="mb-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Notes
              </h3>
              {order.note && (
                <p className="text-sm bg-muted/50 p-2 rounded">{order.note}</p>
              )}
              {order.deliveryNote && (
                <p className="text-sm bg-blue-500/10 text-blue-400 p-2 rounded mt-1">
                  Delivery: {order.deliveryNote}
                </p>
              )}
            </section>
          </>
        )}

        <Separator className="mb-4" />

        {/* Timeline */}
        <section className="mb-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <Clock size={12} /> Timeline
          </h3>
          <div className="relative pl-4 space-y-3">
            {/* vertical line */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {timeline.map((step, i) => {
              const isActive = !!step.time;
              const isLast = i === timeline.length - 1;
              return (
                <div key={step.label} className="relative flex items-start gap-3">
                  <div className={`absolute -left-4 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.time ? formatDateTime(step.time) : 'Pending'}
                    </p>
                    {/* Duration to next step */}
                    {isActive && !isLast && timeline[i + 1]?.time && (
                      <p className="text-xs text-amber-400 mt-0.5">
                        {formatDuration(step.time!, timeline[i + 1].time!)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total time */}
          {order.createdAt && order.completedAt && (
            <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded flex justify-between">
              <span>Total time</span>
              <span className="font-medium text-foreground">
                {formatDuration(order.createdAt, order.completedAt)}
              </span>
            </div>
          )}
        </section>

        {/* Order ID (debug) */}
        <div className="text-xs text-muted-foreground/50 pt-2 border-t border-border font-mono break-all">
          ID: {order.id}
        </div>
      </SheetContent>
    </Sheet>
  );
}
