import { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import type { KDSOrder } from '../../types';
import OrderDetailPanel from '@/components/OrderDetailPanel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RefreshCw, ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  cancelRate: number;
  totalTips: number;
  totalTax: number;
  totalCommission: number;
  netRevenue: number;
  canceledOrders: number;
  refundedOrders: number;
}

interface HourlyData { hour: number; orders: number; revenue: number }
interface SourceData { source: string; orders: number; revenue: number; commission: number }
interface PaymentData { method: string; orders: number; revenue: number }
interface ItemData { name: string; quantity: number; revenue: number }

interface StaffMember { id: string; name: string; is_active: boolean }
interface TimeEntry { id: string; staff_id: string; staff_name: string; clock_in: string; clock_out: string | null }

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatMoney(cents: number) {
  if (cents >= 100000) return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatShortMoney(cents: number) {
  if (cents >= 100_00) return `$${Math.round(cents / 100)}`;
  return `$${(cents / 100).toFixed(0)}`;
}

function todayStr(tz: string) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

function formatTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function orderStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING_PAYMENT: { label: 'Cash Due',    className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' },
    OPEN:            { label: 'Open',        className: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' },
    IN_PROGRESS:     { label: 'In Progress', className: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' },
    READY:           { label: 'Ready',       className: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30' },
  };
  const s = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.className}`}>{s.label}</span>;
}

function orderSourceLabel(source: string) {
  return source === 'Uber Eats' ? 'UE' : source === 'Square Online' ? 'SqO' : source;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminLiveDashboardPage() {
  const restaurantCode = useAdminStore((s) => s.restaurantCode);
  const pin = useAdminStore((s) => s.pin);
  const theme = useAdminStore((s) => s.theme);
  const config = useAdminStore((s) => s.config);
  const isDark = theme === 'dark';
  const tz = config?.timezone || 'America/Los_Angeles';

  const [selectedDate, setSelectedDate] = useState(todayStr(tz));
  const isToday = selectedDate === todayStr(tz);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeOrders, setActiveOrders] = useState<KDSOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<KDSOrder | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const analyticsBase = restaurantCode ? `${SERVER_URL}/api/analytics/${restaurantCode.toLowerCase()}` : '';
  const staffBase = restaurantCode ? `${SERVER_URL}/api/staff/${restaurantCode.toLowerCase()}` : '';
  const ordersBase = restaurantCode ? `${SERVER_URL}/api/orders/${restaurantCode.toLowerCase()}` : '';

  const fetchAll = useCallback(async () => {
    if (!analyticsBase || !staffBase) return;
    setLoading(true);
    try {
      const params = `from=${selectedDate}&to=${selectedDate}`;

      // Analytics + Staff + Orders in parallel
      const [analyticsResults, staffResults, ordersRes] = await Promise.all([
        // Analytics (5 calls)
        Promise.all([
          fetch(`${analyticsBase}/summary?${params}`),
          fetch(`${analyticsBase}/hourly?${params}`),
          fetch(`${analyticsBase}/sources?${params}`),
          fetch(`${analyticsBase}/payment-methods?${params}`),
          fetch(`${analyticsBase}/items?${params}&limit=100`),
        ]),
        // Staff (2 calls) — separate so PIN errors don't kill analytics
        Promise.all([
          fetch(`${staffBase}?pin=${pin}`).catch(() => null),
          fetch(`${staffBase}/time-entries?from=${selectedDate}&to=${selectedDate}&pin=${pin}`).catch(() => null),
        ]),
        // Active orders
        ordersBase
          ? fetch(`${ordersBase}/history?status=PENDING_PAYMENT,OPEN,IN_PROGRESS&${params}&limit=50`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const [sumRes, hourRes, srcRes, pmRes, itemRes] = analyticsResults;
      const [sum, hour, src, pm, itm] = await Promise.all([
        sumRes.json(), hourRes.json(), srcRes.json(), pmRes.json(), itemRes.json(),
      ]);
      setSummary(sum);
      setHourly((hour.data || []).filter((h: HourlyData) => h.orders > 0));
      setSources(src.data || []);
      setPaymentMethods(pm.data || []);
      setItems(itm.data || []);

      // Staff parsing with error handling
      const [staffRes, teRes] = staffResults;
      if (staffRes?.ok) {
        const staffData = await staffRes.json();
        const staffArr = Array.isArray(staffData) ? staffData : (staffData?.staff ?? []);
        setStaffList(staffArr.filter((s: StaffMember) => s.is_active));
      } else {
        console.warn('[LiveDashboard] Staff fetch failed:', staffRes?.status);
      }
      if (teRes?.ok) {
        const teData = await teRes.json();
        const teArr = Array.isArray(teData) ? teData : (teData?.entries ?? []);
        setTimeEntries(teArr);
      } else {
        console.warn('[LiveDashboard] Time entries fetch failed:', teRes?.status);
      }

      // Active orders
      if (ordersRes?.ok) {
        const ordersData = await ordersRes.json();
        setActiveOrders(ordersData.orders ?? []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('[LiveDashboard] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [analyticsBase, staffBase, ordersBase, pin, selectedDate]);

  useEffect(() => {
    fetchAll();
    // Only auto-poll when viewing today
    if (isToday) {
      const interval = setInterval(fetchAll, 60_000);
      return () => clearInterval(interval);
    }
  }, [fetchAll, isToday]);

  // ─── Chart styles ─────────────────────────────────────────────────────────
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#1f2937' : '#fff',
    border: '1px solid',
    borderColor: isDark ? '#374151' : '#e5e7eb',
  };
  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickStyle = { fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' };

  // ─── Staff status ─────────────────────────────────────────────────────────
  const staffStatus = staffList.map((staff) => {
    const entries = timeEntries.filter((e) => e.staff_id === staff.id);
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && !lastEntry.clock_out) {
      return { ...staff, status: 'in' as const, clockIn: lastEntry.clock_in, clockOut: null };
    }
    if (lastEntry && lastEntry.clock_out) {
      return { ...staff, status: 'out' as const, clockIn: lastEntry.clock_in, clockOut: lastEntry.clock_out };
    }
    return { ...staff, status: 'absent' as const, clockIn: null, clockOut: null };
  });

  return (
    <div className="px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{isToday ? "Today's Dashboard" : 'Dashboard'}</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          aria-label="Refresh"
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
          aria-label="Previous day"
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 text-sm font-normal gap-1.5">
              <CalendarIcon size={14} className="text-muted-foreground" />
              {formatDateDisplay(selectedDate)}
              {isToday && <span className="text-xs text-muted-foreground ml-1">(Today)</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={new Date(selectedDate + 'T12:00:00')}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date.toLocaleDateString('en-CA'));
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>

        <button
          onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          disabled={isToday}
          aria-label="Next day"
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>

        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedDate(todayStr(tz))}
          >
            Today
          </Button>
        )}
      </div>

      {/* Sales Summary — 3 cards in a row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-card border-border">
          <span className="text-xs text-muted-foreground">Revenue</span>
          <p className="text-lg font-bold text-foreground">{formatMoney(summary?.totalRevenue ?? 0)}</p>
          <p className="text-xs text-muted-foreground">Net {formatMoney(summary?.netRevenue ?? 0)}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <span className="text-xs text-muted-foreground">Orders</span>
          <p className="text-lg font-bold text-foreground">{summary?.totalOrders ?? 0}</p>
          <p className="text-xs text-muted-foreground">Tips {formatMoney(summary?.totalTips ?? 0)}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <span className="text-xs text-muted-foreground">Canceled</span>
          <p className="text-lg font-bold text-foreground">{summary?.canceledOrders ?? 0}</p>
          <p className="text-xs text-muted-foreground">Refund {summary?.refundedOrders ?? 0}</p>
        </Card>
      </div>

      {/* Active Orders */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-foreground">Active Orders</h3>
          {activeOrders.length > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">{activeOrders.length}</Badge>
          )}
        </div>
        {activeOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active orders</p>
        ) : (
          <div className="space-y-1.5">
            {activeOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="w-full flex items-center justify-between text-sm p-2 rounded-md hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">{order.displayId}</span>
                  <span className="truncate">{order.displayName}</span>
                  {orderStatusBadge(order.status)}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{orderSourceLabel(order.source)}</span>
                  <span className="text-xs font-medium">{formatMoney(order.totalMoney)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Staff Clock Status */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{isToday ? 'Staff Today' : `Staff — ${formatDateDisplay(selectedDate)}`}</h3>
        {staffStatus.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active staff</p>
        ) : (
          <div className="space-y-2">
            {staffStatus.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    s.status === 'in' ? 'bg-green-500' :
                    s.status === 'out' ? 'bg-gray-400' :
                    'bg-muted'
                  }`} />
                  <span className={s.status === 'absent' ? 'text-muted-foreground' : 'text-foreground'}>{s.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.status === 'in' && s.clockIn ? `In since ${formatTime(s.clockIn, tz)}` : ''}
                  {s.status === 'out' && s.clockIn ? `${formatTime(s.clockIn, tz)} — ${formatTime(s.clockOut!, tz)}` : ''}
                  {s.status === 'absent' ? 'Not clocked in' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hourly Sales */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Hourly Sales</h3>
        {hourly.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No sales data yet</p>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 18, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="hour" tickFormatter={(h) => h < 12 ? `${h || 12}a` : `${h === 12 ? 12 : h - 12}p`} tick={tickStyle} />
                <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(h: any) => { const hr = Number(h); return hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`; }}
                  formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="revenue" position="top" formatter={(v: any) => formatShortMoney(Number(v))} style={{ fontSize: 10, fill: isDark ? '#d1d5db' : '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* By Source - Horizontal Bar */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">By Source</h3>
        {sources.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No sales data yet</p>
        ) : (
          <div style={{ height: Math.max(120, sources.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sources} layout="vertical" margin={{ top: 5, right: 45, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tickFormatter={formatShortMoney} tick={tickStyle} />
                <YAxis type="category" dataKey="source" tick={tickStyle} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                  {sources.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <LabelList dataKey="revenue" position="right" formatter={(v: any) => formatShortMoney(Number(v))} style={{ fontSize: 10, fill: isDark ? '#d1d5db' : '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {sources.map((s, i) => (
              <div key={s.source} className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {s.source}: {s.orders} orders
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* By Payment Method - Horizontal Bar */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">By Payment Method</h3>
        {paymentMethods.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No sales data yet</p>
        ) : (
          <div style={{ height: Math.max(120, paymentMethods.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentMethods} layout="vertical" margin={{ top: 5, right: 45, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tickFormatter={formatShortMoney} tick={tickStyle} />
                <YAxis type="category" dataKey="method" tick={tickStyle} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                  {paymentMethods.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <LabelList dataKey="revenue" position="right" formatter={(v: any) => formatShortMoney(Number(v))} style={{ fontSize: 10, fill: isDark ? '#d1d5db' : '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {paymentMethods.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {paymentMethods.map((pm, i) => (
              <div key={pm.method} className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {pm.method}: {pm.orders} orders
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* By Item - All items horizontal bar */}
      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">By Item</h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No sales data yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => {
              const maxRev = items[0]?.revenue || 1;
              const pct = (item.revenue / maxRev) * 100;
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-foreground truncate max-w-[55%]">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground">{formatMoney(item.revenue)} · {item.quantity} sold</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Order Detail Sheet */}
      <OrderDetailPanel
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        allowDirectStatus
        onStatusChange={async (orderId, status) => {
          try {
            await fetch(`${SERVER_URL}/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status, restaurantCode }),
            });
            fetchAll();
            setSelectedOrder((prev) =>
              prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null
            );
          } catch (err) {
            console.error('[LiveDashboard] Status update failed:', err);
          }
        }}
      />
    </div>
  );
}
