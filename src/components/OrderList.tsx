import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KDSOrder } from '../types';
import { formatTime, getItemDisplay, getModifierDisplay } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface Props {
  orders: KDSOrder[];
  onUpdateStatus: (orderId: string, status: KDSOrder['status']) => void;
  onPrint: (order: KDSOrder) => void;
}

const SOURCE_SHORT: Record<string, string> = {
  'Kiosk':         'K',
  'DoorDash':      'D',
  'Uber Eats':     'U',
  'Grubhub':       'G',
  'Square Online': 'O',
  'Unknown':       '?',
};

const SOURCE_COLOR: Record<string, string> = {
  'Kiosk':         'bg-blue-600 text-white',
  'DoorDash':      'bg-red-600 text-white',
  'Uber Eats':     'bg-green-700 text-white',
  'Grubhub':       'bg-orange-500 text-white',
  'Square Online': 'bg-purple-600 text-white',
  'Unknown':       'bg-muted text-muted-foreground',
};

const STATUS_ROW_BG: Record<string, string> = {
  OPEN:        '',
  IN_PROGRESS: 'bg-yellow-500/5 border-l-4 border-l-yellow-400',
  READY:       'bg-green-500/5 border-l-4 border-l-green-400',
  COMPLETED:   'opacity-40',
  CANCELED:    'opacity-40',
};

export default function OrderList({ orders, onUpdateStatus, onPrint }: Props) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;

  return (
    <div className="flex flex-col gap-1">
      {orders.map((order) => {
        const rowBg = STATUS_ROW_BG[order.status] ?? '';

        return (
          <div
            key={order.id}
            className={`flex items-center gap-3 px-4 py-2 rounded-md border border-border bg-card ${rowBg}`}
          >
            {/* 순번 */}
            <span className="text-lg font-black w-12 shrink-0 text-center">
              #{order.displayId}
            </span>

            {/* Source badge */}
            <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 ${SOURCE_COLOR[order.source] ?? SOURCE_COLOR['Unknown']}`}>
              {SOURCE_SHORT[order.source] ?? '?'}
            </span>

            {/* 메뉴 항목 칩들 */}
            <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
              {order.lineItems.map((item, idx) => {
                const display = getItemDisplay(item.name, menuItems);
                if (!display.showOnKds) return null;
                const modChips = (item.modifiers ?? [])
                  .map((m) => getModifierDisplay(m, modifierDisplay))
                  .filter((d) => d.showOnKds);
                return (
                  <span key={idx} className="flex items-center gap-1">
                    {Number(item.quantity) > 1 && (
                      <span className="text-xs font-bold text-muted-foreground">{item.quantity}×</span>
                    )}
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: display.bgColor, color: display.textColor }}
                    >
                      {display.label}
                      {display.serverAlert && <span className="ml-0.5 text-red-500">⚠</span>}
                    </span>
                    {modChips.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        [{modChips.map((d) => d.serverAlert ? `⚠${d.label}` : d.label).join(' ')}]
                      </span>
                    )}
                  </span>
                );
              })}
              {order.note && (
                <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-400 ml-1">
                  📝
                </Badge>
              )}
            </div>

            {/* 고객 이름 */}
            <span className="text-sm font-semibold w-24 shrink-0 truncate text-right hidden sm:block">
              {order.displayName}
            </span>

            {/* 시간 */}
            <span className="text-xs text-muted-foreground w-14 shrink-0 text-right hidden md:block">
              {formatTime(order.createdAt)}
            </span>

            {/* 상태 버튼 */}
            <div className="flex gap-1 shrink-0">
              {order.status === 'OPEN' && (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                  onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
                >
                  Start
                </Button>
              )}
              {order.status === 'IN_PROGRESS' && (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs bg-green-600 hover:bg-green-500 font-bold"
                  onClick={() => onUpdateStatus(order.id, 'READY')}
                >
                  Ready
                </Button>
              )}
              {order.status === 'READY' && (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-500 font-bold"
                  onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
                >
                  Done
                </Button>
              )}
              {order.status === 'COMPLETED' && (
                <span className="text-green-400 font-bold text-xs w-12 text-center">✓</span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-xs no-print"
                onClick={() => onPrint(order)}
                title="Print"
              >
                🖨️
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
