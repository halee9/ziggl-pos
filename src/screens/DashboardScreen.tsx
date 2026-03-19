import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, ShoppingBag, TrendingUp, XCircle,
  RefreshCw, ArrowUp, ArrowDown, CalendarIcon,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ─── 타입 ───────────────────────────────────────────────────────────────────
interface Summary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  cancelRate: number;
  totalTips: number;
  canceledOrders: number;
  today: { revenue: number; orders: number };
  yesterday: { revenue: number; orders: number };
}

interface SalesPoint { date: string; revenue: number; orders: number; tips?: number }
interface ItemData { name: string; quantity: number; revenue: number }
interface SourceData { source: string; orders: number; revenue: number }
interface HourlyData { hour: number; orders: number; revenue: number }

// ─── 유틸 ───────────────────────────────────────────────────────────────────
function formatMoney(cents: number) {
  if (cents >= 100000) return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatShortMoney(cents: number) {
  if (cents >= 100_00) return `$${Math.round(cents / 100)}`;
  return `$${(cents / 100).toFixed(0)}`;
}

function toLocalDate(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function getFromDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDate(d);
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type PresetKey = '0' | '7' | '14' | '30' | 'custom';

const PRESETS: { value: PresetKey; label: string }[] = [
  { value: '0', label: 'Today' },
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
];

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const theme = useSessionStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [preset, setPreset] = useState<PresetKey>('0');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [weeklySales, setWeeklySales] = useState<SalesPoint[]>([]);
  const [monthlySales, setMonthlySales] = useState<SalesPoint[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);

  // 날짜 범위 계산
  const { from, to } = useMemo(() => {
    if (preset === 'custom' && dateRange?.from) {
      return {
        from: toLocalDate(dateRange.from),
        to: dateRange.to ? toLocalDate(dateRange.to) : toLocalDate(dateRange.from),
      };
    }
    const days = parseInt(preset);
    return { from: getFromDate(days), to: undefined as string | undefined };
  }, [preset, dateRange]);

  // 기간 설명 텍스트
  const periodLabel = useMemo(() => {
    if (preset === 'custom' && dateRange?.from) {
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dateRange.to && toLocalDate(dateRange.from) !== toLocalDate(dateRange.to)) {
        return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
      }
      return fmt(dateRange.from);
    }
    return PRESETS.find((p) => p.value === preset)?.label || '';
  }, [preset, dateRange]);

  const fetchAll = useCallback(async () => {
    if (!restaurantCode) return;
    setLoading(true);
    const base = `${SERVER_URL}/api/analytics/${restaurantCode.toLowerCase()}`;
    const params = to ? `from=${from}&to=${to}` : `from=${from}`;

    try {
      const [sumRes, salesRes, weekRes, monthRes, itemsRes, srcRes, hourRes] = await Promise.all([
        fetch(`${base}/summary?${params}`),
        fetch(`${base}/sales?${params}&groupBy=day`),
        fetch(`${base}/sales?${params}&groupBy=week`),
        fetch(`${base}/sales?${params}&groupBy=month`),
        fetch(`${base}/items?${params}&limit=8`),
        fetch(`${base}/sources?${params}`),
        fetch(`${base}/hourly?${params}`),
      ]);

      const [sumData, salesData, weekData, monthData, itemsData, srcData, hourData] = await Promise.all([
        sumRes.json(), salesRes.json(), weekRes.json(), monthRes.json(),
        itemsRes.json(), srcRes.json(), hourRes.json(),
      ]);

      setSummary(sumData);
      setSales(salesData.data || []);
      setWeeklySales(weekData.data || []);
      setMonthlySales(monthData.data || []);
      setItems(itemsData.data || []);
      setSources(srcData.data || []);
      setHourly((hourData.data || []).filter((h: HourlyData) => h.orders > 0));
    } catch (err) {
      console.error('[Dashboard] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, from, to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 요일별 데이터 (daily sales 기반 클라이언트 집계)
  const dayOfWeekData = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => ({
      day: DAY_NAMES[i],
      dayIndex: i,
      totalRevenue: 0,
      totalOrders: 0,
      count: 0,
    }));
    for (const s of sales) {
      const d = new Date(s.date + 'T12:00:00'); // noon to avoid DST edge
      const dayIdx = d.getDay();
      buckets[dayIdx].totalRevenue += s.revenue;
      buckets[dayIdx].totalOrders += s.orders;
      buckets[dayIdx].count += 1;
    }
    // Mon-Sun 순서로 정렬
    const ordered = [...buckets.slice(1), buckets[0]];
    return ordered.map((b) => ({
      day: b.day,
      avgRevenue: b.count > 0 ? Math.round(b.totalRevenue / b.count) : 0,
      avgOrders: b.count > 0 ? Math.round((b.totalOrders / b.count) * 10) / 10 : 0,
      totalRevenue: b.totalRevenue,
      totalOrders: b.totalOrders,
      days: b.count,
    }));
  }, [sales]);

  // 차트 공통 스타일
  const tooltipStyle = {
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: 8,
    fontSize: 12,
    color: isDark ? '#f9fafb' : '#111827',
  };
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const tickStyle = { fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' };

  const formatChartDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatWeekDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(d)}–${fmt(end)}`;
  };

  const formatMonth = (date: string) => {
    // date is YYYY-MM
    const [y, m] = date.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const todayVsYesterday = summary
    ? summary.yesterday.revenue > 0
      ? Math.round(((summary.today.revenue - summary.yesterday.revenue) / summary.yesterday.revenue) * 100)
      : summary.today.revenue > 0 ? 100 : 0
    : 0;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={preset === p.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => { setPreset(p.value); setDateRange(undefined); }}
              >
                {p.label}
              </Button>
            ))}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={preset === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <CalendarIcon size={13} />
                  {preset === 'custom' && periodLabel && (
                    <span className="ml-1 max-w-[120px] truncate">{periodLabel}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from) {
                      setPreset('custom');
                      if (range.to) setCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={1}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Revenue"
              value={formatMoney(summary.totalRevenue)}
              icon={<DollarSign size={16} />}
              sub={`Today: ${formatMoney(summary.today.revenue)}`}
              trend={todayVsYesterday}
            />
            <SummaryCard
              label="Orders"
              value={String(summary.totalOrders)}
              icon={<ShoppingBag size={16} />}
              sub={`Today: ${summary.today.orders}`}
            />
            <SummaryCard
              label="Avg. Order"
              value={formatMoney(summary.avgOrderValue)}
              icon={<TrendingUp size={16} />}
              sub={`Tips: ${formatMoney(summary.totalTips)}`}
            />
            <SummaryCard
              label="Cancel Rate"
              value={`${summary.cancelRate}%`}
              icon={<XCircle size={16} />}
              sub={`${summary.canceledOrders} canceled`}
              negative
            />
          </div>
        )}

        {/* Analysis Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="dow">Day of Week</TabsTrigger>
          </TabsList>

          {/* ─── Daily Tab ─── */}
          <TabsContent value="daily" className="space-y-4 mt-4">
            {/* Sales Trend */}
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Daily Sales</h3>
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tickFormatter={formatChartDate} tick={tickStyle} />
                    <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(l: any) => formatChartDate(String(l))}
                      formatter={(v: any, n: any) => [n === 'revenue' ? formatMoney(Number(v)) : v, n === 'revenue' ? 'Revenue' : 'Orders']}
                    />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Sources + Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SourcesChart sources={sources} tooltipStyle={tooltipStyle} />
              <ItemsChart items={items} />
            </div>

            {/* Hourly */}
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Hourly Pattern</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="hour" tickFormatter={(h) => h < 12 ? `${h || 12}a` : `${h === 12 ? 12 : h - 12}p`} tick={tickStyle} />
                    <YAxis tick={tickStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(h: any) => { const hour = Number(h); return hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`; }}
                      formatter={(v: any, n: any) => [n === 'revenue' ? formatMoney(Number(v)) : v, n === 'revenue' ? 'Revenue' : 'Orders']}
                    />
                    <Bar dataKey="orders" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* ─── Weekly Tab ─── */}
          <TabsContent value="weekly" className="space-y-4 mt-4">
            {/* This Week vs Last Week */}
            {weeklySales.length >= 2 && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 bg-card border-border">
                  <span className="text-xs text-muted-foreground">This Week</span>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {formatMoney(weeklySales[weeklySales.length - 1]?.revenue || 0)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {weeklySales[weeklySales.length - 1]?.orders || 0} orders
                  </span>
                </Card>
                <Card className="p-3 bg-card border-border">
                  <span className="text-xs text-muted-foreground">Last Week</span>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {formatMoney(weeklySales[weeklySales.length - 2]?.revenue || 0)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {weeklySales[weeklySales.length - 2]?.orders || 0} orders
                  </span>
                </Card>
              </div>
            )}

            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Weekly Sales</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklySales} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tickFormatter={formatWeekDate} tick={tickStyle} />
                    <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(l: any) => `Week of ${formatWeekDate(String(l))}`}
                      formatter={(v: any, n: any) => [n === 'revenue' ? formatMoney(Number(v)) : v, n === 'revenue' ? 'Revenue' : 'Orders']}
                    />
                    <Bar dataKey="revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SourcesChart sources={sources} tooltipStyle={tooltipStyle} />
              <ItemsChart items={items} />
            </div>
          </TabsContent>

          {/* ─── Monthly Tab ─── */}
          <TabsContent value="monthly" className="space-y-4 mt-4">
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Monthly Sales</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySales} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tickFormatter={formatMonth} tick={tickStyle} />
                    <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(l: any) => formatMonth(String(l))}
                      formatter={(v: any, n: any) => [n === 'revenue' ? formatMoney(Number(v)) : v, n === 'revenue' ? 'Revenue' : 'Orders']}
                    />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Monthly table */}
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Monthly Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4 text-right">Orders</th>
                      <th className="py-2 pr-4 text-right">Revenue</th>
                      <th className="py-2 text-right">Avg/Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySales.map((m) => (
                      <tr key={m.date} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-foreground">{formatMonth(m.date)}</td>
                        <td className="py-2 pr-4 text-right text-foreground">{m.orders}</td>
                        <td className="py-2 pr-4 text-right text-foreground">{formatMoney(m.revenue)}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {m.orders > 0 ? formatMoney(Math.round(m.revenue / m.orders)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SourcesChart sources={sources} tooltipStyle={tooltipStyle} />
              <ItemsChart items={items} />
            </div>
          </TabsContent>

          {/* ─── Day of Week Tab ─── */}
          <TabsContent value="dow" className="space-y-4 mt-4">
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Average Revenue by Day of Week</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="day" tick={tickStyle} />
                    <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: any, n: any) => [
                        n === 'avgRevenue' ? formatMoney(Number(v)) : v,
                        n === 'avgRevenue' ? 'Avg Revenue' : 'Avg Orders',
                      ]}
                    />
                    <Bar dataKey="avgRevenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Day of Week Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4 text-right">Days</th>
                      <th className="py-2 pr-4 text-right">Avg Orders</th>
                      <th className="py-2 pr-4 text-right">Avg Revenue</th>
                      <th className="py-2 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayOfWeekData.map((d) => (
                      <tr key={d.day} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-foreground">{d.day}</td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">{d.days}</td>
                        <td className="py-2 pr-4 text-right text-foreground">{d.avgOrders}</td>
                        <td className="py-2 pr-4 text-right text-foreground">{formatMoney(d.avgRevenue)}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatMoney(d.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── 공유 차트 컴포넌트 ──────────────────────────────────────────────────────

function SourcesChart({ sources, tooltipStyle }: {
  sources: SourceData[];
  tooltipStyle: React.CSSProperties;
}) {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">Order Sources</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sources}
              dataKey="revenue"
              nameKey="source"
              cx="50%"
              cy="50%"
              outerRadius={75}
              innerRadius={40}
              paddingAngle={2}
              label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {sources.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: any) => formatMoney(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
        {sources.map((s, i) => (
          <div key={s.source} className="flex items-center gap-1 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {s.source} ({s.orders})
          </div>
        ))}
      </div>
    </Card>
  );
}

function ItemsChart({ items }: { items: ItemData[] }) {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">Popular Items</h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const maxRev = items[0]?.revenue || 1;
          const pct = (item.revenue / maxRev) * 100;
          return (
            <div key={item.name}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-foreground truncate max-w-[60%]">
                  <span className="text-muted-foreground mr-1">#{i + 1}</span>
                  {item.name}
                </span>
                <span className="text-muted-foreground">
                  {formatMoney(item.revenue)} · {item.quantity} sold
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, sub, trend, negative }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  trend?: number;
  negative?: boolean;
}) {
  return (
    <Card className="p-3 bg-card border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-foreground">{value}</div>
      <div className="flex items-center gap-1 mt-1">
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs flex items-center gap-0.5 ml-auto ${
            (negative ? trend > 0 : trend > 0) ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {trend > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </Card>
  );
}
