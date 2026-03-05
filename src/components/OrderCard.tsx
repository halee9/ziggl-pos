import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KDSOrder } from '../types';
import { formatMoney, formatTime, formatElapsed, getElapsedMinutes, getItemDisplay, getModifierDisplay } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface Props {
  order: KDSOrder;
  onUpdateStatus: (orderId: string, status: KDSOrder['status']) => void;
  onPrint: (order: KDSOrder) => void;
}

const SOURCE_VARIANT: Record<string, string> = {
  'DoorDash':     'bg-red-600 text-white hover:bg-red-600',
  'Uber Eats':    'bg-green-700 text-white hover:bg-green-700',
  'Grubhub':      'bg-orange-500 text-white hover:bg-orange-500',
  'Square Online':'bg-purple-600 text-white hover:bg-purple-600',
  'Kiosk':        'bg-blue-600 text-white hover:bg-blue-600',
  'Unknown':      'bg-muted text-muted-foreground',
};

function formatPickupAt(pickupAt: string): string {
  if (!pickupAt) return '';
  const d = new Date(pickupAt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function OrderCard({ order, onUpdateStatus, onPrint }: Props) {
  const elapsed = getElapsedMinutes(order.createdAt);
  const isUrgent = elapsed >= 15 && order.status === 'OPEN';
  const pickupTime = formatPickupAt(order.pickupAt);
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;

  return (
    <Card className={`flex flex-col gap-0 overflow-hidden transition-all border-2
      ${order.status === 'COMPLETED' ? 'opacity-50 border-border' : ''}
      ${order.status === 'IN_PROGRESS' ? 'border-yellow-400' : ''}
      ${order.status === 'READY' ? 'border-green-400' : ''}
      ${order.status === 'OPEN' && !isUrgent ? 'border-border' : ''}
      ${isUrgent ? 'border-red-500 shadow-lg shadow-red-900/40' : ''}
    `}>
      {/* Header */}
      <CardHeader className={`flex flex-row items-center justify-between px-4 py-3 space-y-0
        ${order.status === 'IN_PROGRESS' ? 'bg-yellow-500/10' : ''}
        ${order.status === 'READY' ? 'bg-green-500/10' : ''}
        ${isUrgent ? 'bg-red-500/10' : ''}
      `}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-black tracking-tight">#{order.displayId}</span>
          <Badge className={SOURCE_VARIANT[order.source] ?? SOURCE_VARIANT['Unknown']}>
            {order.source}
          </Badge>
          {order.isDelivery && (
            <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">🚗 Delivery</Badge>
          )}
          {order.isScheduled && (
            <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">📅 Scheduled</Badge>
          )}
        </div>
        <div className="text-right leading-tight shrink-0">
          <div className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</div>
          <div className={`text-xs font-bold ${isUrgent ? 'text-red-400' : 'text-muted-foreground'}`}>
            {formatElapsed(order.createdAt)}
          </div>
        </div>
      </CardHeader>

      {/* Customer name + pickup time */}
      {(order.displayName || pickupTime) && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
          {order.displayName && (
            <span className="text-sm font-semibold text-foreground">{order.displayName}</span>
          )}
          {pickupTime && (
            <span className="text-xs text-muted-foreground ml-auto">
              {order.isScheduled ? '📅' : '⏱'} {pickupTime}
            </span>
          )}
        </div>
      )}

      {/* Line items */}
      <CardContent className="flex flex-col gap-2 px-4 py-3 border-t border-border">
        {order.lineItems.map((item, idx) => {
          const display = getItemDisplay(item.name, menuItems);
          return (
            <div key={idx}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm min-w-[1.5rem]">{item.quantity}×</span>
                <span
                  className="px-2 py-0.5 rounded font-bold text-sm"
                  style={{ backgroundColor: display.bgColor, color: display.textColor }}
                >
                  {display.label}
                </span>
                {item.variationName && (
                  <span className="text-muted-foreground text-xs">({item.variationName})</span>
                )}
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="ml-6 mt-0.5 flex flex-wrap gap-1">
                  {item.modifiers.map((mod, mIdx) => (
                    <span key={mIdx} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {getModifierDisplay(mod, modifierDisplay)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {order.note && (
          <div className="mt-1 text-xs text-yellow-200 bg-yellow-900/30 border border-yellow-800/40 rounded px-2 py-1">
            📝 {order.note}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <span className="font-bold text-sm flex-1">{formatMoney(order.totalMoney)}</span>

        {order.status === 'OPEN' && (
          <Button
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
            onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
          >
            Start
          </Button>
        )}
        {order.status === 'IN_PROGRESS' && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-500 font-bold"
            onClick={() => onUpdateStatus(order.id, 'READY')}
          >
            Ready ✓
          </Button>
        )}
        {order.status === 'READY' && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 font-bold"
            onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
          >
            Complete ✓
          </Button>
        )}
        {order.status === 'COMPLETED' && (
          <span className="text-green-400 font-bold text-sm">✓ Done</span>
        )}

        <Button
          size="sm"
          variant="outline"
          className="no-print px-2"
          onClick={() => onPrint(order)}
          title="Print ticket"
        >
          🖨️
        </Button>
      </CardFooter>
    </Card>
  );
}
