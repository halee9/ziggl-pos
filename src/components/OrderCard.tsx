import { Truck, Calendar, Clock, AlertTriangle, FileText, Printer, Check, CheckCheck, ChevronLeft, Banknote, X } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KDSOrder } from '../types';
import { formatMoney, formatElapsed, getElapsedMinutes, getItemDisplay, getModifierDisplay, mergeLineItems } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface Props {
  order: KDSOrder;
  onUpdateStatus: (orderId: string, status: KDSOrder['status']) => void;
  onPrint: (order: KDSOrder) => void;
  onConfirmCash?: (orderId: string) => void;
  onRejectCash?: (orderId: string) => void;
}

const SOURCE_VARIANT: Record<string, string> = {
  'DoorDash':     'bg-red-600 text-white hover:bg-red-600',
  'Uber Eats':    'bg-green-700 text-white hover:bg-green-700',
  'Grubhub':      'bg-orange-500 text-white hover:bg-orange-500',
  'Square Online':'bg-purple-600 text-white hover:bg-purple-600',
  'Online':       'bg-teal-600 text-white hover:bg-teal-600',
  'Kiosk':        'bg-blue-600 text-white hover:bg-blue-600',
  'Unknown':      'bg-muted text-muted-foreground',
};

function formatPickupAt(pickupAt: string): string {
  if (!pickupAt) return '';
  const d = new Date(pickupAt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function OrderCard({ order, onUpdateStatus, onPrint, onConfirmCash, onRejectCash }: Props) {
  const elapsed = getElapsedMinutes(order.createdAt);
  const isUrgent = elapsed >= 15 && order.status === 'OPEN';
  const pickupTime = formatPickupAt(order.pickupAt);
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;

  return (
    <Card className={`flex flex-col gap-0 py-0 overflow-hidden transition-all border-2
      ${order.status === 'COMPLETED' ? 'opacity-50 border-border' : ''}
      ${order.status === 'PENDING_PAYMENT' ? 'border-amber-400 shadow-lg shadow-amber-900/30' : ''}
      ${order.status === 'IN_PROGRESS' ? 'border-yellow-400' : ''}
      ${order.status === 'READY' ? 'border-green-400' : ''}
      ${order.status === 'OPEN' && !isUrgent ? 'border-border' : ''}
      ${isUrgent ? 'border-red-500 shadow-lg shadow-red-900/40' : ''}
    `}>
      {/* Cash payment banner */}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="bg-amber-500 text-black px-5 py-2 text-sm font-bold flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          CASH — Collect {formatMoney(order.totalMoney)}
        </div>
      )}

      {/* Header */}
      <CardHeader className={`flex flex-row items-center justify-between px-5 py-3.5 space-y-0
        ${order.status === 'IN_PROGRESS' ? 'bg-yellow-500/10' : ''}
        ${order.status === 'READY' ? 'bg-green-500/10' : ''}
        ${isUrgent ? 'bg-red-500/10' : ''}
      `}>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge className={`shrink-0 ${SOURCE_VARIANT[order.source] ?? SOURCE_VARIANT['Unknown']}`}>
            {order.source}
          </Badge>
          <span className="text-4xl font-black tracking-tight shrink-0">#{order.displayId}</span>
          {order.displayName && (
            <span className="text-lg font-semibold text-muted-foreground truncate">{order.displayName}</span>
          )}
          {order.isDelivery && (
            <Badge variant="outline" className="shrink-0 text-xs border-blue-500 text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Truck className="h-3 w-3" /> Delivery
            </Badge>
          )}
          {order.isScheduled && (
            <Badge variant="outline" className="shrink-0 text-xs border-purple-500 text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Scheduled
            </Badge>
          )}
          {order.duplicateOf && (
            <Badge className="shrink-0 text-xs bg-red-600 text-white flex items-center gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" /> Duplicate of #{order.duplicateOf}
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0 leading-tight">
          <div className={`text-xl font-black ${isUrgent ? 'text-red-400' : 'text-muted-foreground'}`}>
            {formatElapsed(order.createdAt)}
          </div>
          {pickupTime && (
            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
              {order.isScheduled ? <Calendar className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {pickupTime}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Line items */}
      <CardContent className="flex flex-col gap-3 px-5 py-4 border-t border-border">
        {mergeLineItems(order.lineItems).map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          if (!display.showOnKds) return null;
          return (
            <div key={idx} className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xl min-w-[2rem]">{item.quantity}×</span>
              <span
                className="px-2.5 py-1 rounded-md font-bold text-xl leading-tight"
                style={{ backgroundColor: display.bgColor, color: display.textColor }}
              >
                {display.label}
                {display.serverAlert && (
                  <AlertTriangle className="inline ml-1.5 h-4 w-4 text-red-500" />
                )}
              </span>
              {item.variationName && (
                <span className="text-muted-foreground text-base">({item.variationName})</span>
              )}
              {item.modifiers?.map((mod, mIdx) => {
                const modDisplay = getModifierDisplay(mod, modifierDisplay);
                if (!modDisplay.showOnKds) return null;
                return (
                  <span key={mIdx} className="text-lg bg-muted px-2.5 py-0.5 rounded text-muted-foreground flex items-center gap-1">
                    {modDisplay.qty > 1 && <span className="font-bold">{modDisplay.qty}×</span>}
                    {modDisplay.label}
                    {modDisplay.serverAlert && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    )}
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
          <div className="mt-1 text-lg text-yellow-800 bg-yellow-100 border border-yellow-300 dark:text-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800/40 rounded px-3 py-1.5 flex items-start gap-2">
            <FileText className="h-5 w-5 mt-0.5 shrink-0" />
            {order.note}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="flex flex-col gap-0 p-0 border-t border-border">
        {/* Row 1: price + print */}
        <div className="flex items-center px-5 py-3 bg-muted/20 w-full">
          <span className="font-bold text-xl flex-1">{formatMoney(order.totalMoney)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 no-print text-muted-foreground hover:text-foreground"
            onClick={() => onPrint(order)}
            title="Print ticket"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>

        {/* Row 2: backward + forward buttons */}
        <div className="px-5 pb-4 pt-2 w-full">
          {order.status === 'PENDING_PAYMENT' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-lg font-bold shrink-0"
                onClick={() => onRejectCash?.(order.id)}
              >
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-lg font-bold text-base bg-green-600 hover:bg-green-500 border-0"
                onClick={() => onConfirmCash?.(order.id)}
              >
                <Banknote className="mr-2 h-4 w-4" /> Cash Paid
              </Button>
            </div>
          )}
          {order.status === 'OPEN' && (
            <Button
              className="w-full h-11 rounded-lg font-bold text-base bg-yellow-500 hover:bg-yellow-400 text-black border-0"
              onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
            >
              Start
            </Button>
          )}
          {order.status === 'IN_PROGRESS' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 w-11 rounded-lg p-0 shrink-0"
                onClick={() => onUpdateStatus(order.id, 'OPEN')}
                title="Back to Open"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                className="flex-1 h-11 rounded-lg font-bold text-base bg-green-600 hover:bg-green-500 border-0"
                onClick={() => onUpdateStatus(order.id, 'READY')}
              >
                <Check className="mr-2 h-4 w-4" /> Ready
              </Button>
            </div>
          )}
          {order.status === 'READY' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 w-11 rounded-lg p-0 shrink-0"
                onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
                title="Back to In Progress"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                className="flex-1 h-11 rounded-lg font-bold text-base bg-blue-600 hover:bg-blue-500 border-0"
                onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
              >
                <CheckCheck className="mr-2 h-4 w-4" /> Complete
              </Button>
            </div>
          )}
          {order.status === 'COMPLETED' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 w-11 rounded-lg p-0 shrink-0"
                onClick={() => onUpdateStatus(order.id, 'READY')}
                title="Back to Ready"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400 font-bold text-sm">
                <Check className="h-4 w-4" /> Done
              </div>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
