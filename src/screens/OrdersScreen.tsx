import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { KDSOrder, OrderStatus, OrderSource } from '../types';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Filter, X, AlertTriangle, CalendarIcon, Banknote,
} from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import OrderDetailPanel from '../components/OrderDetailPanel';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING_PAYMENT', label: 'Cash Due' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY', label: 'Ready' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'Kiosk', label: 'Kiosk' },
  { value: 'Online', label: 'Online' },
  { value: 'DoorDash', label: 'DoorDash' },
  { value: 'Uber Eats', label: 'Uber Eats' },
  { value: 'Grubhub', label: 'Grubhub' },
  { value: 'Square Online', label: 'Square Online' },
];

const LIMIT = 200;

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
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

function sourceBadge(source: OrderSource) {
  const colors: Record<string, string> = {
    Kiosk:           'bg-purple-500/20 text-purple-400',
    Online:          'bg-cyan-500/20 text-cyan-400',
    DoorDash:        'bg-red-500/20 text-red-400',
    'Uber Eats':     'bg-green-500/20 text-green-400',
    Grubhub:         'bg-orange-500/20 text-orange-400',
    'Square Online': 'bg-indigo-500/20 text-indigo-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[source] ?? 'bg-muted text-muted-foreground'}`}>
      {source}
    </span>
  );
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
  if (!iso) return '-';
  const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: tz,
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

interface OrdersScreenProps {
  restaurantCode?: string | null;
  allowDelete?: boolean;
}

export default function OrdersScreen({ restaurantCode: propCode, allowDelete }: OrdersScreenProps = {}) {
  const storeCode = useSessionStore((s) => s.restaurantCode);
  const restaurantCode = propCode ?? storeCode;

  // data
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // detail
  const [selectedOrder, setSelectedOrder] = useState<KDSOrder | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchOrders = useCallback(async () => {
    if (!restaurantCode) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (search) params.set('search', search);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(
        `${SERVER_URL}/api/orders/${restaurantCode.toLowerCase()}/history?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('[Orders] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, page, statusFilter, sourceFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 검색 디바운스 처리 (Enter 또는 명시적)
  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setSourceFilter('all');
    setSearch('');
    setSearchInput('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all' || search || dateFrom || dateTo;

  const itemSummary = (order: KDSOrder) => {
    const count = order.lineItems.reduce((sum, li) => sum + parseInt(li.quantity || '1'), 0);
    const firstItem = order.lineItems[0]?.name ?? '';
    if (order.lineItems.length <= 1) return `${count}x ${firstItem}`;
    return `${firstItem} +${order.lineItems.length - 1} more`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-foreground">Orders</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-amber-500/50 text-amber-400' : ''}
            >
              <Filter size={14} />
              <span className="hidden sm:inline ml-1">Filters</span>
              {hasActiveFilters && (
                <span className="ml-1 text-xs bg-amber-500/30 px-1.5 rounded-full">!</span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order # or customer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 h-9 text-sm"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button size="sm" onClick={handleSearch} className="h-9">
            Search
          </Button>
        </div>

        {/* Filter panel (collapsible) */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2 items-end">
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground mb-1 block">Source</label>
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 text-sm w-[140px] justify-start font-normal">
                    <CalendarIcon size={14} className="mr-1.5 text-muted-foreground" />
                    {dateFrom ? new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-muted-foreground">Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom ? new Date(dateFrom + 'T00:00:00') : undefined}
                    onSelect={(date) => { setDateFrom(date ? date.toLocaleDateString('en-CA') : ''); setPage(1); }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 text-sm w-[140px] justify-start font-normal">
                    <CalendarIcon size={14} className="mr-1.5 text-muted-foreground" />
                    {dateTo ? new Date(dateTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-muted-foreground">Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo ? new Date(dateTo + 'T00:00:00') : undefined}
                    onSelect={(date) => { setDateTo(date ? date.toLocaleDateString('en-CA') : ''); setPage(1); }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X size={12} className="mr-1" /> Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-auto">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <p className="text-sm">No orders found</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: Card list */}
            <div className="sm:hidden divide-y divide-border">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">#{order.displayId}</span>
                      {sourceBadge(order.source)}
                      {order.paymentMethod === 'CASH' && <Badge className="bg-amber-600 text-white border-0 text-xs flex items-center gap-0.5"><Banknote className="h-3 w-3" />CASH</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      {statusBadge(order.status)}
                      {order.refundedAt && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Refunded</Badge>}
                      {order.duplicateOf && <Badge className="bg-red-600 text-white text-xs flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Dup #{order.duplicateOf}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {order.displayName || 'Guest'}
                    </span>
                    <span className="font-medium">{formatMoney(order.totalMoney)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {itemSummary(order)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: Table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Order #</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold">#{order.displayId}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                      {order.displayName || 'Guest'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {itemSummary(order)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(order.totalMoney)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {statusBadge(order.status)}
                        {order.refundedAt && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Refunded</Badge>}
                        {order.duplicateOf && <Badge className="bg-red-600 text-white text-xs flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Dup #{order.duplicateOf}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {sourceBadge(order.source)}
                        {order.paymentMethod === 'CASH' && <Badge className="bg-amber-600 text-white border-0 text-xs flex items-center gap-0.5"><Banknote className="h-3 w-3" />CASH</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            {((page - 1) * LIMIT) + 1}-{Math.min(page * LIMIT, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Panel */}
      <OrderDetailPanel
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        allowDirectStatus={allowDelete}
        onStatusChange={async (orderId, status) => {
          try {
            await fetch(`${SERVER_URL}/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status, restaurantCode }),
            });
            fetchOrders();
            setSelectedOrder((prev) =>
              prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null
            );
          } catch (err) {
            console.error('[Orders] status update failed:', err);
          }
        }}
        onRefund={async (orderId) => {
          const res = await fetch(`${SERVER_URL}/api/orders/${orderId}/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantCode }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Refund failed');
            throw new Error(data.error || 'Refund failed');
          }
          const data = await res.json().catch(() => ({}));
          if (data.autoRefunded === false) {
            alert('Order cancelled. Please process the payment refund manually via Stripe/Square dashboard.');
          }
          fetchOrders();
        }}
        onDelete={allowDelete ? async (orderId) => {
          const res = await fetch(`${SERVER_URL}/api/orders/${orderId}`, { method: 'DELETE' });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Delete failed');
            throw new Error(data.error || 'Delete failed');
          }
          fetchOrders();
        } : undefined}
      />
    </div>
  );
}
