import type { KDSOrder } from '../types';
import OrderCard from './OrderCard';

interface Props {
  orders: KDSOrder[];
  onUpdateStatus: (orderId: string, status: KDSOrder['status'], intent?: 'revert') => void;
  onPrint: (order: KDSOrder) => void;
}

export default function DoneTabView({ orders, onUpdateStatus, onPrint }: Props) {
  const sorted = [...orders].sort((a, b) =>
    (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground select-none">
        <div className="text-5xl mb-4">🎉</div>
        <div className="text-lg">No completed orders</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((o) => (
          <OrderCard key={o.id} order={o} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
        ))}
      </div>
    </div>
  );
}
