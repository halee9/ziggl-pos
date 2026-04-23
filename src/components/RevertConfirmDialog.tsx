import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { OrderStatus } from '../types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
};

export interface RevertRequest {
  displayId: string | number;
  from: OrderStatus;
  to: OrderStatus;
  onConfirm: () => void;
}

interface Props {
  request: RevertRequest | null;
  onClose: () => void;
}

export default function RevertConfirmDialog({ request, onClose }: Props) {
  const open = request !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Revert order status?</DialogTitle>
          <DialogDescription>
            {request && (
              <>
                Order <strong>#{request.displayId}</strong> will be moved back from{' '}
                <strong>{STATUS_LABEL[request.from]}</strong> to{' '}
                <strong>{STATUS_LABEL[request.to]}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              request?.onConfirm();
              onClose();
            }}
          >
            Yes, revert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
