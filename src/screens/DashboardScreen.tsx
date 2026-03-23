import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ─── 타입 ───────────────────────────────────────────────────────────────────
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
}

interface ItemData { name: string; quantity: number; revenue: number }
interface SourceData { source: string; orders: number; revenue: number; commission: number }
interface HourlyData { hour: number; orders: number; revenue: number }

interface CompareEntry {
  year: number;
  date?: string;
  from?: string;
  to?: string;
  label: string;
  revenue: number;
  netRevenue: number;
  orders: number;
  tips: number;
  commission: number;
  tax: number;
}

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  predictedRevenue: number;
  predictedOrders: number;
  weather?: { tempMax: number; precipitation: number; condition: string; adjustment: number };
}

interface WeeklyBreakdown {
  date: string;
  dayOfWeek: string;
  revenue: number;
  netRevenue: number;
  orders: number;
  tips: number;
}

interface SalesPoint { date: string; revenue: number; orders: number }

// ─── 유틸 ───────────────────────────────────────────────────────────────────
function formatMoney(cents: number) {
  if (cents >= 100000) return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatShortMoney(cents: number) {
  if (cents >= 100_00) return `$${Math.round(cents / 100)}`;
  return `$${(cents / 100).toFixed(0)}`;
}

function getTz() {
  return useSessionStore.getState().timezone || 'America/Los_Angeles';
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: getTz() });
}

// 날짜에서 N일 이동
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 날짜의 요일 이름
function dayName(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' });
}

// 날짜 포맷: Mar 21
function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// 주의 월요일 구하기
function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899'];

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────
interface DashboardScreenProps {
  restaurantCode?: string | null;
  theme?: 'light' | 'dark';
}

export default function DashboardScreen({ restaurantCode: propCode, theme: propTheme }: DashboardScreenProps = {}) {
  const storeCode = useSessionStore((s) => s.restaurantCode);
  const storeTheme = useSessionStore((s) => s.theme);
  const restaurantCode = propCode ?? storeCode;
  const theme = propTheme ?? storeTheme;
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);

  // Daily state
  const [dailyDate, setDailyDate] = useState(todayStr());
  const [dailySummary, setDailySummary] = useState<Summary | null>(null);
  const [dailyCompare, setDailyCompare] = useState<CompareEntry[]>([]);
  const [dailyHourly, setDailyHourly] = useState<HourlyData[]>([]);
  const [dailySources, setDailySources] = useState<SourceData[]>([]);
  const [dailyPaymentMethods, setDailyPaymentMethods] = useState<SourceData[]>([]);
  const [dailyItems, setDailyItems] = useState<ItemData[]>([]);

  // Weekly state
  const [weekStart, setWeekStart] = useState(getMonday(todayStr()));
  const [weeklySummary, setWeeklySummary] = useState<Summary | null>(null);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<WeeklyBreakdown[]>([]);
  const [weeklyCompare, setWeeklyCompare] = useState<CompareEntry[]>([]);
  const [weeklyHourly, setWeeklyHourly] = useState<HourlyData[]>([]);
  const [weeklySources, setWeeklySources] = useState<SourceData[]>([]);
  const [weeklyPaymentMethods, setWeeklyPaymentMethods] = useState<SourceData[]>([]);
  const [weeklyItems, setWeeklyItems] = useState<ItemData[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<SalesPoint[]>([]);

  // Forecast state
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [forecastWeekTotal, setForecastWeekTotal] = useState<{ revenue: number; orders: number; commission: number } | null>(null);
  const [forecastCorrelation, setForecastCorrelation] = useState<{ dayOfWeek: string; clearDays: number; rainDays: number; rainImpact: number }[]>([]);
  const [forecastRecentWeeks, setForecastRecentWeeks] = useState<SalesPoint[]>([]);

  // Monthly state
  const [monthStr, setMonthStr] = useState(todayStr().slice(0, 7)); // YYYY-MM
  const [monthlySummary, setMonthlySummary] = useState<Summary | null>(null);
  const [monthlyCompare, setMonthlyCompare] = useState<CompareEntry[]>([]);
  const [monthlyHourly, setMonthlyHourly] = useState<HourlyData[]>([]);
  const [monthlySources, setMonthlySources] = useState<SourceData[]>([]);
  const [monthlyPaymentMethods, setMonthlyPaymentMethods] = useState<SourceData[]>([]);
  const [monthlyItems, setMonthlyItems] = useState<ItemData[]>([]);

  const base = restaurantCode ? `${SERVER_URL}/api/analytics/${restaurantCode.toLowerCase()}` : '';

  // ─── Daily fetch ─────────────────────────────────────────────────────────
  const fetchDaily = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const params = `from=${dailyDate}&to=${dailyDate}`;
      const [sumRes, compRes, hourRes, srcRes, pmRes, itemRes] = await Promise.all([
        fetch(`${base}/summary?${params}`),
        fetch(`${base}/compare?date=${dailyDate}&mode=day`),
        fetch(`${base}/hourly?${params}`),
        fetch(`${base}/sources?${params}`),
        fetch(`${base}/payment-methods?${params}`),
        fetch(`${base}/items?${params}&limit=8`),
      ]);
      const [sum, comp, hour, src, pm, items] = await Promise.all([
        sumRes.json(), compRes.json(), hourRes.json(), srcRes.json(), pmRes.json(), itemRes.json(),
      ]);
      setDailySummary(sum);
      setDailyCompare(comp.comparisons || []);
      setDailyHourly((hour.data || []).filter((h: HourlyData) => h.orders > 0));
      setDailySources(src.data || []);
      setDailyPaymentMethods((pm.data || []).map((d: any) => ({ source: d.method, orders: d.orders, revenue: d.revenue, commission: 0 })));
      setDailyItems(items.data || []);
    } catch (err) {
      console.error('[Dashboard] daily fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [base, dailyDate]);

  // ─── Weekly fetch ────────────────────────────────────────────────────────
  const fetchWeekly = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const weekEnd = shiftDate(weekStart, 6);
      const params = `from=${weekStart}&to=${weekEnd}`;
      const midWeek = shiftDate(weekStart, 3);
      // Core data first (fast), forecast + trend in background (slow)
      const [sumRes, compRes, hourRes, srcRes, pmRes, itemRes] = await Promise.all([
        fetch(`${base}/summary?${params}`),
        fetch(`${base}/compare?date=${midWeek}&mode=week`),
        fetch(`${base}/hourly?${params}`),
        fetch(`${base}/sources?${params}`),
        fetch(`${base}/payment-methods?${params}`),
        fetch(`${base}/items?${params}&limit=8`),
      ]);
      const [sum, comp, hour, src, pm, items] = await Promise.all([
        sumRes.json(), compRes.json(), hourRes.json(), srcRes.json(), pmRes.json(), itemRes.json(),
      ]);
      setWeeklySummary(sum);
      setWeeklyBreakdown(comp.dailyBreakdown || []);
      setWeeklyCompare(comp.comparisons || []);
      setWeeklyHourly((hour.data || []).filter((h: HourlyData) => h.orders > 0));
      setWeeklySources(src.data || []);
      setWeeklyPaymentMethods((pm.data || []).map((d: any) => ({ source: d.method, orders: d.orders, revenue: d.revenue, commission: 0 })));
      setWeeklyItems(items.data || []);

      // Trend in background (don't block UI)
      fetch(`${base}/sales?from=${shiftDate(weekStart, -16 * 7)}&to=${weekEnd}&groupBy=week`).then(r => r.json()).then(trend => {
        setWeeklyTrend(trend.data || []);
      }).catch(() => {});
    } catch (err) {
      console.error('[Dashboard] weekly fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [base, weekStart]);

  // ─── Monthly fetch ───────────────────────────────────────────────────────
  const fetchMonthly = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const [y, m] = monthStr.split('-').map(Number);
      const fromDate = `${monthStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const toDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
      const params = `from=${fromDate}&to=${toDate}`;
      const [sumRes, compRes, hourRes, srcRes, pmRes, itemRes] = await Promise.all([
        fetch(`${base}/summary?${params}`),
        fetch(`${base}/compare?date=${monthStr}&mode=month`),
        fetch(`${base}/hourly?${params}`),
        fetch(`${base}/sources?${params}`),
        fetch(`${base}/payment-methods?${params}`),
        fetch(`${base}/items?${params}&limit=8`),
      ]);
      const [sum, comp, hour, src, pm, items] = await Promise.all([
        sumRes.json(), compRes.json(), hourRes.json(), srcRes.json(), pmRes.json(), itemRes.json(),
      ]);
      setMonthlySummary(sum);
      setMonthlyCompare(comp.comparisons || []);
      setMonthlyHourly((hour.data || []).filter((h: HourlyData) => h.orders > 0));
      setMonthlySources(src.data || []);
      setMonthlyPaymentMethods((pm.data || []).map((d: any) => ({ source: d.method, orders: d.orders, revenue: d.revenue, commission: 0 })));
      setMonthlyItems(items.data || []);
    } catch (err) {
      console.error('[Dashboard] monthly fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [base, monthStr]);

  // ─── Forecast fetch ──────────────────────────────────────────────────────
  const fetchForecast = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}/forecast`);
      const fc = await res.json();
      setForecast((fc.forecast || []).filter((f: ForecastDay) => f.predictedRevenue > 0));
      setForecastWeekTotal(fc.weekTotal || null);
      setForecastCorrelation(fc.weatherCorrelation || []);
      setForecastRecentWeeks(fc.recentWeeks || []);
    } catch (err) {
      console.error('[Dashboard] forecast fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [base]);

  // Tab 변경 시 데이터 fetch
  useEffect(() => {
    if (activeTab === 'daily') fetchDaily();
    else if (activeTab === 'weekly') fetchWeekly();
    else if (activeTab === 'monthly') fetchMonthly();
    else if (activeTab === 'forecast') fetchForecast();
  }, [activeTab, fetchDaily, fetchWeekly, fetchMonthly, fetchForecast]);

  // Daily 탭 + 오늘 날짜일 때 60초 polling
  useEffect(() => {
    if (activeTab !== 'daily' || dailyDate !== todayStr()) return;
    const id = setInterval(fetchDaily, 60_000);
    return () => clearInterval(id);
  }, [activeTab, dailyDate, fetchDaily]);

  // 차트 스타일
  const tooltipStyle = {
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: 8, fontSize: 12,
    color: isDark ? '#f9fafb' : '#111827',
  };
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const tickStyle = { fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' };

  const canGoForwardDaily = dailyDate < todayStr();
  const canGoForwardWeek = shiftDate(weekStart, 7) <= getMonday(todayStr());
  const canGoForwardMonth = monthStr < todayStr().slice(0, 7);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => {
            if (activeTab === 'daily') fetchDaily();
            else if (activeTab === 'weekly') fetchWeekly();
            else fetchMonthly();
          }} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          {/* ═══════════════════ DAILY TAB ═══════════════════ */}
          <TabsContent value="daily" className="space-y-4 mt-4">
            {/* Date nav */}
            <DateNav
              label={`${shortDate(dailyDate)} (${dayName(dailyDate)})`}
              onPrev={() => setDailyDate(shiftDate(dailyDate, -1))}
              onNext={() => setDailyDate(shiftDate(dailyDate, 1))}
              canNext={canGoForwardDaily}
            />

            {dailySummary && (
              <>
                <SummaryCards summary={dailySummary} />
                <CompareTable comparisons={dailyCompare} label="Same day of week" current={dailySummary ? { revenue: dailySummary.totalRevenue, netRevenue: dailySummary.netRevenue, orders: dailySummary.totalOrders, tips: dailySummary.totalTips } : undefined} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <HourlyChart data={dailyHourly} tooltipStyle={tooltipStyle} gridStroke={gridStroke} tickStyle={tickStyle} />
                  <SourcesChart sources={dailySources} tooltipStyle={tooltipStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SourcesChart sources={dailyPaymentMethods} tooltipStyle={tooltipStyle} title="Payment Methods" />
                  <ItemsChart items={dailyItems} />
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════ WEEKLY TAB ═══════════════════ */}
          <TabsContent value="weekly" className="space-y-4 mt-4">
            <DateNav
              label={`${shortDate(weekStart)} – ${shortDate(shiftDate(weekStart, 6))}`}
              onPrev={() => setWeekStart(shiftDate(weekStart, -7))}
              onNext={() => setWeekStart(shiftDate(weekStart, 7))}
              canNext={canGoForwardWeek}
            />

            {weeklySummary && (
              <>
                <SummaryCards summary={weeklySummary} />

                {/* Daily breakdown */}
                <Card className="p-4 bg-card border-border">
                  <h3 className="text-sm font-medium text-foreground mb-3">Daily Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-3">Day</th>
                          <th className="py-2 pr-3 text-right">Revenue</th>
                          <th className="py-2 pr-3 text-right">Net</th>
                          <th className="py-2 pr-3 text-right">Orders</th>
                          <th className="py-2 text-right">Tips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyBreakdown.map((d) => (
                          <tr key={d.date} className="border-b border-border/50">
                            <td className="py-1.5 pr-3 text-foreground text-xs">{d.dayOfWeek} {shortDate(d.date)}</td>
                            <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(d.revenue)}</td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">{formatMoney(d.netRevenue)}</td>
                            <td className="py-1.5 pr-3 text-right text-foreground">{d.orders}</td>
                            <td className="py-1.5 text-right text-muted-foreground">{formatMoney(d.tips)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <CompareTable comparisons={weeklyCompare} label="Same week in previous years" current={weeklySummary ? { revenue: weeklySummary.totalRevenue, netRevenue: weeklySummary.netRevenue, orders: weeklySummary.totalOrders, tips: weeklySummary.totalTips } : undefined} />


                {/* Weekly trend chart */}
                {weeklyTrend.length > 0 && (
                  <Card className="p-4 bg-card border-border">
                    <h3 className="text-sm font-medium text-foreground mb-3">Weekly Revenue Trend</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="date" tickFormatter={(d) => shortDate(d)} tick={tickStyle} />
                          <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                          <Tooltip contentStyle={tooltipStyle}
                            labelFormatter={(l: any) => `Week of ${shortDate(String(l))}`}
                            formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']}
                          />
                          <Bar dataKey="revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <HourlyChart data={weeklyHourly} tooltipStyle={tooltipStyle} gridStroke={gridStroke} tickStyle={tickStyle} />
                  <SourcesChart sources={weeklySources} tooltipStyle={tooltipStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SourcesChart sources={weeklyPaymentMethods} tooltipStyle={tooltipStyle} title="Payment Methods" />
                  <ItemsChart items={weeklyItems} />
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════ MONTHLY TAB ═══════════════════ */}
          <TabsContent value="monthly" className="space-y-4 mt-4">
            <DateNav
              label={(() => {
                const [y, m] = monthStr.split('-').map(Number);
                return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              })()}
              onPrev={() => {
                const [y, m] = monthStr.split('-').map(Number);
                const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
                setMonthStr(prev);
              }}
              onNext={() => {
                const [y, m] = monthStr.split('-').map(Number);
                const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
                setMonthStr(next);
              }}
              canNext={canGoForwardMonth}
            />

            {monthlySummary && (
              <>
                <SummaryCards summary={monthlySummary} />
                <CompareTable comparisons={monthlyCompare} label="Same month in previous years" current={monthlySummary ? { revenue: monthlySummary.totalRevenue, netRevenue: monthlySummary.netRevenue, orders: monthlySummary.totalOrders, tips: monthlySummary.totalTips } : undefined} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <HourlyChart data={monthlyHourly} tooltipStyle={tooltipStyle} gridStroke={gridStroke} tickStyle={tickStyle} />
                  <SourcesChart sources={monthlySources} tooltipStyle={tooltipStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SourcesChart sources={monthlyPaymentMethods} tooltipStyle={tooltipStyle} title="Payment Methods" />
                  <ItemsChart items={monthlyItems} />
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════ FORECAST TAB ═══════════════════ */}
          <TabsContent value="forecast" className="space-y-4 mt-4">
            <div className="text-center text-sm text-muted-foreground">
              Next 7 days from {shortDate(shiftDate(todayStr(), 1))}
            </div>

            {/* Week total */}
            {forecastWeekTotal && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 bg-card border-border text-center">
                  <span className="text-xs text-muted-foreground">Est. Revenue</span>
                  <div className="text-lg font-bold text-foreground mt-1">{formatMoney(forecastWeekTotal.revenue)}</div>
                </Card>
                <Card className="p-3 bg-card border-border text-center">
                  <span className="text-xs text-muted-foreground">Est. Orders</span>
                  <div className="text-lg font-bold text-foreground mt-1">{forecastWeekTotal.orders}</div>
                </Card>
                <Card className="p-3 bg-card border-border text-center">
                  <span className="text-xs text-muted-foreground">Est. Commission</span>
                  <div className="text-lg font-bold text-foreground mt-1">{formatMoney(forecastWeekTotal.commission)}</div>
                </Card>
              </div>
            )}

            {/* Daily forecast */}
            {forecast.length > 0 && (
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Daily Forecast</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Day</th>
                        <th className="py-2 pr-3 text-right">Revenue</th>
                        <th className="py-2 pr-3 text-right">Orders</th>
                        <th className="py-2 text-right">Weather</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.map((f) => (
                        <tr key={f.date} className="border-b border-border/50">
                          <td className="py-1.5 pr-3 text-foreground text-xs">{f.dayOfWeek} {shortDate(f.date)}</td>
                          <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(f.predictedRevenue)}</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground">{f.predictedOrders}</td>
                          <td className="py-1.5 text-right text-xs text-muted-foreground">
                            {f.weather ? (
                              <>
                                {f.weather.condition} {f.weather.tempMax.toFixed(0)}°C
                                {f.weather.precipitation > 0 && ` 💧${f.weather.precipitation.toFixed(0)}mm`}
                                {f.weather.adjustment !== 0 && (
                                  <span className={f.weather.adjustment < 0 ? 'text-red-400' : 'text-emerald-400'}>
                                    {' '}{f.weather.adjustment > 0 ? '+' : ''}{f.weather.adjustment}%
                                  </span>
                                )}
                              </>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Recent weeks trend */}
            {forecastRecentWeeks.length > 0 && (
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Recent Weekly Trend</h3>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastRecentWeeks} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="week" tickFormatter={(d) => shortDate(d)} tick={tickStyle} />
                      <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
                      <Tooltip contentStyle={tooltipStyle}
                        labelFormatter={(l: any) => `Week of ${shortDate(String(l))}`}
                        formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Weather correlation */}
            {forecastCorrelation.length > 0 && (
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Weather Impact (all-time)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Day</th>
                        <th className="py-2 pr-3 text-right">Clear</th>
                        <th className="py-2 pr-3 text-right">Rain/Snow</th>
                        <th className="py-2 text-right">Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastCorrelation.map((c) => (
                        <tr key={c.dayOfWeek} className="border-b border-border/50">
                          <td className="py-1.5 pr-3 text-foreground text-xs">{c.dayOfWeek}</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground">{c.clearDays} days</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground">{c.rainDays} days</td>
                          <td className="py-1.5 text-right text-xs">
                            {c.rainImpact === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className={c.rainImpact < 0 ? 'text-red-400' : 'text-emerald-400'}>
                                {c.rainImpact > 0 ? '+' : ''}{c.rainImpact}%
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {forecast.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading forecast...</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── 공유 컴포넌트 ──────────────────────────────────────────────────────────

function DateNav({ label, onPrev, onNext, canNext }: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onPrev}>
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm font-medium text-foreground min-w-[180px] text-center">{label}</span>
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onNext} disabled={!canNext}>
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-3 bg-card border-border">
        <span className="text-xs text-muted-foreground">Revenue</span>
        <div className="text-xl font-bold text-foreground mt-1">{formatMoney(summary.totalRevenue)}</div>
      </Card>
      <Card className="p-3 bg-card border-border">
        <span className="text-xs text-muted-foreground">Net Revenue</span>
        <div className="text-xl font-bold text-foreground mt-1">{formatMoney(summary.netRevenue)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Tax {formatMoney(summary.totalTax)} · Fee {formatMoney(summary.totalCommission)}
        </div>
      </Card>
      <Card className="p-3 bg-card border-border">
        <span className="text-xs text-muted-foreground">Orders</span>
        <div className="text-xl font-bold text-foreground mt-1">{summary.totalOrders}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Avg {formatMoney(summary.avgOrderValue)}
          {summary.cancelRate > 0 && ` · Cancel ${summary.cancelRate}%`}
        </div>
      </Card>
      <Card className="p-3 bg-card border-border">
        <span className="text-xs text-muted-foreground">Tips</span>
        <div className="text-xl font-bold text-foreground mt-1">{formatMoney(summary.totalTips)}</div>
      </Card>
    </div>
  );
}

function CompareTable({ comparisons, label, current }: {
  comparisons: CompareEntry[];
  label: string;
  current?: { revenue: number; netRevenue: number; orders: number; tips: number };
}) {
  if (!current && comparisons.length === 0) return null;

  function trendBadge(currentVal: number, pastVal: number) {
    if (!pastVal || !currentVal) return null;
    const pct = Math.round(((currentVal - pastVal) / pastVal) * 100);
    if (pct === 0) return null;
    return (
      <span className={`text-[10px] ml-1 ${pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {pct > 0 ? '+' : ''}{pct}%
      </span>
    );
  }

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">{label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">Period</th>
              <th className="py-2 pr-3 text-right">Revenue</th>
              <th className="py-2 pr-3 text-right">Net</th>
              <th className="py-2 pr-3 text-right">Orders</th>
              <th className="py-2 text-right">Tips</th>
            </tr>
          </thead>
          <tbody>
            {current && (
              <tr className="border-b border-border bg-muted/30 font-medium">
                <td className="py-1.5 pr-3 text-foreground text-xs">Current</td>
                <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(current.revenue)}</td>
                <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(current.netRevenue)}</td>
                <td className="py-1.5 pr-3 text-right text-foreground">{current.orders}</td>
                <td className="py-1.5 text-right text-foreground">{formatMoney(current.tips)}</td>
              </tr>
            )}
            {comparisons.map((c) => (
              <tr key={c.year} className="border-b border-border/50">
                <td className="py-1.5 pr-3 text-foreground text-xs">{c.label}</td>
                <td className="py-1.5 pr-3 text-right text-foreground">
                  {formatMoney(c.revenue)}
                  {current && trendBadge(current.revenue, c.revenue)}
                </td>
                <td className="py-1.5 pr-3 text-right text-muted-foreground">{formatMoney(c.netRevenue)}</td>
                <td className="py-1.5 pr-3 text-right text-foreground">
                  {c.orders}
                  {current && trendBadge(current.orders, c.orders)}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">{formatMoney(c.tips)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function HourlyChart({ data, tooltipStyle, gridStroke, tickStyle }: {
  data: HourlyData[];
  tooltipStyle: React.CSSProperties;
  gridStroke: string;
  tickStyle: { fontSize: number; fill: string };
}) {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">Hourly Revenue</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="hour" tickFormatter={(h) => h < 12 ? `${h || 12}a` : `${h === 12 ? 12 : h - 12}p`} tick={tickStyle} />
            <YAxis tickFormatter={formatShortMoney} tick={tickStyle} />
            <Tooltip contentStyle={tooltipStyle}
              labelFormatter={(h: any) => { const hr = Number(h); return hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`; }}
              formatter={(v: any) => [formatMoney(Number(v)), 'Revenue']}
            />
            <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SourcesChart({ sources, tooltipStyle, title = 'Order Sources' }: { sources: SourceData[]; tooltipStyle: React.CSSProperties; title?: string }) {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sources} dataKey="revenue" nameKey="source" cx="50%" cy="50%"
              outerRadius={70} innerRadius={35} paddingAngle={2}
              label={false}
              labelLine={false}
            >
              {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatMoney(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
        {(() => {
          const totalRev = sources.reduce((s, x) => s + x.revenue, 0);
          return sources.map((s, i) => {
            const pct = totalRev > 0 ? Math.round((s.revenue / totalRev) * 100) : 0;
            return (
              <div key={s.source} className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {s.source} {pct}% {formatMoney(s.revenue)}
              </div>
            );
          });
        })()}
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
                  <span className="text-muted-foreground mr-1">#{i + 1}</span>{item.name}
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
    </Card>
  );
}
