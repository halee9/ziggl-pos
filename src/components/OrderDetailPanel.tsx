import { useState, useEffect, useCallback } from 'react';
import type { KDSOrder, OrderStatus } from '../types';
import { useSessionStore } from '../stores/sessionStore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Clock, CreditCard, User, Package,
  ChefHat, CheckCircle2, XCircle,
  ArrowRight, Undo2, Flag, AlertTriangle,
  FileText, Camera, QrCode, Upload, X,
} from 'lucide-react';

interface Props {
  order: KDSOrder | null;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onRefund?: (orderId: string) => Promise<void>;
  onDelete?: (orderId: string) => Promise<void>;
  allowDirectStatus?: boolean;
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

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'PENDING_PAYMENT', label: 'Cash Due' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY', label: 'Ready' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
];

const FLAG_OPTIONS = [
  { value: 'unclaimed' as const, label: 'Unclaimed', icon: <Flag size={12} />, className: 'bg-red-600 hover:bg-red-500 text-white' },
  { value: 'issue' as const, label: 'Issue', icon: <AlertTriangle size={12} />, className: 'bg-orange-600 hover:bg-orange-500 text-white' },
  { value: 'refund_evidence' as const, label: 'Evidence', icon: <FileText size={12} />, className: 'bg-purple-600 hover:bg-purple-500 text-white' },
] as const;

function OrderNoteSection({ order }: { order: KDSOrder }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(order.note || '');
  const { restaurantCode } = useSessionStore();

  useEffect(() => { setNote(order.note || ''); setEditing(false); }, [order.id, order.note]);

  const save = async () => {
    setEditing(false);
    if (note === (order.note || '')) return;
    try {
      await fetch(`${SERVER_URL}/api/orders/${order.id}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, restaurantCode }),
      });
    } catch (err) { console.error('Failed to save note:', err); }
  };

  return (
    <section className="mb-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
        Notes
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
        )}
      </h3>
      {editing ? (
        <textarea
          className="w-full text-sm bg-muted/50 p-2 rounded border border-border min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
          autoFocus
          placeholder="Add a note..."
        />
      ) : (
        <p className={`text-sm bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted ${!note ? 'text-muted-foreground italic' : ''}`}
          onClick={() => setEditing(true)}>
          {note || 'No notes — tap to add'}
        </p>
      )}
    </section>
  );
}

function OrderFlagSection({ order }: { order: KDSOrder }) {
  const { restaurantCode } = useSessionStore();
  const [saving, setSaving] = useState(false);
  const [localFlag, setLocalFlag] = useState(order.flag);

  useEffect(() => { setLocalFlag(order.flag); }, [order.flag]);

  const toggle = async (flag: string) => {
    const newFlag = localFlag === flag ? null : flag;
    setLocalFlag(newFlag);  // optimistic
    setSaving(true);
    try {
      await fetch(`${SERVER_URL}/api/orders/${order.id}/flag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: newFlag, restaurantCode }),
      });
    } catch (err) {
      console.error('Failed to set flag:', err);
      setLocalFlag(order.flag);  // rollback
    }
    setSaving(false);
  };

  return (
    <section className="mb-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Flag</h3>
      <div className="flex gap-2">
        {FLAG_OPTIONS.map(f => (
          <button
            key={f.value}
            disabled={saving}
            onClick={() => toggle(f.value)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              localFlag === f.value ? f.className : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function OrderPhotosSection({ order }: { order: KDSOrder }) {
  const { restaurantCode } = useSessionStore();
  const [qrOpen, setQrOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const uploadUrl = `${SERVER_URL}/api/orders/${order.id}/upload-page`;
  const photos = order.photos ?? [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const urlRes = await fetch(`${SERVER_URL}/api/orders/${order.id}/photos/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantCode, filename: file.name, contentType: file.type }),
        });
        const { signedUrl, publicUrl } = await urlRes.json();
        await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
        await fetch(`${SERVER_URL}/api/orders/${order.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: publicUrl, restaurantCode }),
        });
      } catch (err) { console.error('Upload failed:', err); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const deletePhoto = async (url: string) => {
    try {
      await fetch(`${SERVER_URL}/api/orders/${order.id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, restaurantCode }),
      });
    } catch (err) { console.error('Delete failed:', err); }
  };

  return (
    <section className="mb-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
        <Camera size={12} /> Photos {photos.length > 0 && `(${photos.length})`}
      </h3>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((p, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer" onClick={() => setViewPhoto(p.url)}>
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={e => { e.stopPropagation(); deletePhoto(p.url); }}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setQrOpen(true)}>
          <QrCode size={14} /> Phone Upload
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-xs relative" disabled={uploading}>
          <Upload size={14} /> {uploading ? 'Uploading...' : 'From Computer'}
          <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        </Button>
      </div>

      {/* QR Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Scan to Upload</DialogTitle>
            <DialogDescription className="text-center">
              Order #{order.displayId} — scan with your phone
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uploadUrl)}`}
              alt="QR Code"
              className="w-48 h-48 rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all">{uploadUrl}</p>
        </DialogContent>
      </Dialog>

      {/* Photo viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-lg p-1">
          <DialogHeader className="sr-only"><DialogTitle>Photo</DialogTitle></DialogHeader>
          {viewPhoto && <img src={viewPhoto} alt="" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function OrderDetailPanel({ order, onClose, onStatusChange, onRefund, onDelete, allowDirectStatus }: Props) {
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const currentRole = useSessionStore((s) => s.role);

  // Reset PIN state when dialog opens/closes
  useEffect(() => {
    if (!refundConfirmOpen) {
      setPin('');
      setPinError('');
      setPinVerified(false);
    }
  }, [refundConfirmOpen]);

  const verifyPin = useCallback(async (enteredPin: string) => {
    if (!restaurantCode) return;
    setVerifyingPin(true);
    setPinError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/config/${restaurantCode}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.role === currentRole) {
          setPinVerified(true);
        } else {
          setPinError('Enter your own PIN');
          setPin('');
        }
      } else {
        setPinError('Incorrect PIN');
        setPin('');
      }
    } catch {
      setPinError('Server error');
      setPin('');
    } finally {
      setVerifyingPin(false);
    }
  }, [restaurantCode]);

  // Auto-submit on 4 digits
  useEffect(() => {
    if (pin.length === 4) verifyPin(pin);
  }, [pin, verifyPin]);

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

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(order.id);
      setDeleteConfirmOpen(false);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setDeleting(false);
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background border-l border-border p-6">
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
        {allowDirectStatus ? (
          <>
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <Select
                value={order.status}
                onValueChange={(v) => onStatusChange(order.id, v as OrderStatus)}
              >
                <SelectTrigger className="h-8 w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canRefund && (
                <Button variant="destructive" size="sm" onClick={() => setRefundConfirmOpen(true)} className="flex items-center gap-1">
                  <Undo2 size={14} /> Refund
                </Button>
              )}
              {order.refundedAt && (
                <Badge variant="outline" className="text-sm bg-red-500/20 text-red-400 border-red-500/30">Refunded</Badge>
              )}
              {onDelete && (
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)}
                  className="flex items-center gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <XCircle size={14} /> Delete
                </Button>
              )}
            </div>
            <Separator className="mb-4" />
          </>
        ) : (actions.length > 0 || canRefund || order.refundedAt) ? (
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
                <Button variant="destructive" size="sm" onClick={() => setRefundConfirmOpen(true)} className="flex items-center gap-1">
                  <Undo2 size={14} /> Refund
                </Button>
              )}
              {order.refundedAt && (
                <Badge variant="outline" className="text-sm bg-red-500/20 text-red-400 border-red-500/30">Refunded</Badge>
              )}
            </div>
            <Separator className="mb-4" />
          </>
        ) : null}

        {/* Refund Confirmation Dialog with PIN */}
        <Dialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Refund</DialogTitle>
              <DialogDescription>
                Refund {formatMoney(order.totalMoney)} for order #{order.displayId}? Enter your PIN to confirm.
              </DialogDescription>
            </DialogHeader>

            {!pinVerified ? (
              <div className="flex flex-col items-center gap-4 py-2">
                {/* PIN dots */}
                <div className="flex gap-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`} />
                  ))}
                </div>
                {pinError && <p className="text-destructive text-sm">{pinError}</p>}
                {verifyingPin && <p className="text-sm text-muted-foreground animate-pulse">Verifying...</p>}
                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9'].map((d) => (
                    <button key={d} type="button" onClick={() => pin.length < 4 && setPin(p => p + d)}
                      className="w-14 h-14 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 text-lg font-bold transition-all">{d}</button>
                  ))}
                  <button type="button" onClick={() => { setPin(''); setPinError(''); }}
                    className="w-14 h-14 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground transition-all">CLR</button>
                  <button type="button" onClick={() => pin.length < 4 && setPin(p => p + '0')}
                    className="w-14 h-14 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 text-lg font-bold transition-all">0</button>
                  <button type="button" onClick={() => setPin(p => p.slice(0, -1))}
                    className="w-14 h-14 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-all">
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-emerald-400 text-sm font-medium">PIN verified</p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRefundConfirmOpen(false)} disabled={refunding}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRefund} disabled={refunding || !pinVerified}>
                {refunding ? 'Processing...' : 'Refund'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Order</DialogTitle>
              <DialogDescription>
                Permanently delete order #{order.displayId} ({formatMoney(order.totalMoney)})? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
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
            {(order.paymentMethod || order.paymentSource) && (
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <span className="capitalize">{order.paymentSource ?? ''}</span>
                {order.paymentMethod && <span>· {order.paymentMethod}</span>}
                {order.cardBrand && <span>· {order.cardBrand}</span>}
                {order.cardLast4 && <span>· •••• {order.cardLast4}</span>}
              </div>
            )}
          </div>
        </section>

        {/* Notes (editable) */}
        <Separator className="mb-4" />
        <OrderNoteSection order={order} />

        {/* Delivery Note (read-only) */}
        {order.deliveryNote && (
          <p className="text-sm bg-blue-500/10 text-blue-400 p-2 rounded mb-4">
            Delivery: {order.deliveryNote}
          </p>
        )}

        {/* Flag */}
        <OrderFlagSection order={order} />

        {/* Photos */}
        <OrderPhotosSection order={order} />

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
