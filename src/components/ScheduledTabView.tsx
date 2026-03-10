import { Calendar } from 'lucide-react';
import type { KDSOrder } from '../types';
import OrderCard from './OrderCard';

interface Props {
  orders: KDSOrder[];
  now: number;
  scheduledActivationMinutes: number;
  onUpdateStatus: (orderId: string, status: KDSOrder['status']) => void;
  onPrint: (order: KDSOrder) => void;
}

function Countdown({ pickupAt, now, activationMin }: { pickupAt: string; now: number; activationMin: number }) {
  const minsUntil = Math.round((new Date(pickupAt).getTime() - now) / 60_000);

  if (minsUntil <= 0) {
    return (
      <div className="flex items-center gap-1 text-xs font-bold text-red-400 mb-1 px-1">
        <Calendar className="h-3 w-3" />
        NOW — start immediately
      </div>
    );
  }

  if (minsUntil <= activationMin) {
    return (
      <div className="flex items-center gap-1 text-xs font-bold text-yellow-400 mb-1 px-1">
        <Calendar className="h-3 w-3" />
        Starting soon — in {minsUntil}m
      </div>
    );
  }

  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 px-1">
      <Calendar className="h-3 w-3" />
      Pickup in {label}
    </div>
  );
}

export default function ScheduledTabView({ orders, now, scheduledActivationMinutes, onUpdateStatus, onPrint }: Props) {
  const sorted = [...orders].sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground select-none">
        <div className="text-5xl mb-4">📅</div>
        <div className="text-lg">No scheduled orders</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((o) => (
          <div key={o.id}>
            {o.pickupAt && (
              <Countdown pickupAt={o.pickupAt} now={now} activationMin={scheduledActivationMinutes} />
            )}
            <OrderCard order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
          </div>
        ))}
      </div>
    </div>
  );
}
