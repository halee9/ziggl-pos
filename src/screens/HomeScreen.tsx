import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useKDSStore } from '../stores/kdsStore';
import { daysAgoStr, todayDisplay } from '../utils/timezone';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  DollarSign, ShoppingBag, TrendingUp, ChefHat,
  ClipboardList, Settings, RefreshCw,
  ArrowUp, ArrowDown, ArrowRight, Clock, Power,
} from 'lucide-react';
import { formatMoney, formatTime } from '../utils';
import { canAccess } from '../utils/roles';
import type { KDSOrder, OrderStatus } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface TodaySummary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalTips: number;
  today: { revenue: number; orders: number };
  yesterday: { revenue: number; orders: number };
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
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
  return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigate = useNavigate();
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const restaurantName = useSessionStore((s) => s.restaurantName);
  const role = useSessionStore((s) => s.role);
  const staffName = useSessionStore((s) => s.staffName);
  const connected = useKDSStore((s) => s.connected);
  const counts = useKDSStore((s) => s.orderCounts)();
  const forceClosed = useSessionStore((s) => s.forceClosed);
  const setForceClosed = useSessionStore((s) => s.setForceClosed);
  const pin = useSessionStore((s) => s.pin);

  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  const showRevenue = role === 'owner';
  const showOrders = canAccess(role, '/orders');
  const showAdmin = role === 'owner';

  const fetchData = useCallback(async () => {
    if (!restaurantCode) return;
    setLoading(true);
    const base = `${SERVER_URL}/api`;

    try {
      const promises: Promise<Response>[] = [];

      // 매출 정보는 owner만
      if (showRevenue) {
        const from = daysAgoStr(1);
        promises.push(fetch(`${base}/analytics/${restaurantCode.toLowerCase()}/summary?from=${from}`));
      } else {
        promises.push(Promise.resolve(new Response('null')));
      }

      // 최근 주문은 manager/owner만
      if (showOrders) {
        promises.push(fetch(`${base}/orders/${restaurantCode.toLowerCase()}/history?limit=5`));
      } else {
        promises.push(Promise.resolve(new Response('{"orders":[]}')));
      }

      const [sumRes, ordersRes] = await Promise.all(promises);
      const sumData = await sumRes.json();
      const ordersData = await ordersRes.json();
      if (sumData) setSummary(sumData);
      setRecentOrders(ordersData.orders ?? []);
    } catch (err) {
      console.error('[Home] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, showRevenue, showOrders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Force close toggle
  const handleForceClose = useCallback(async () => {
    if (!restaurantCode || toggling) return;
    const newValue = !forceClosed;
    setToggling(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/${restaurantCode.toLowerCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, force_closed: newValue }),
      });
      if (res.ok) {
        setForceClosed(newValue);
      }
    } catch (err) {
      console.error('[Home] force close toggle failed:', err);
    } finally {
      setToggling(false);
    }
  }, [restaurantCode, pin, forceClosed, toggling, setForceClosed]);

  // 오늘 vs 어제 매출 트렌드
  const revenueTrend = summary
    ? summary.yesterday.revenue > 0
      ? Math.round(((summary.today.revenue - summary.yesterday.revenue) / summary.yesterday.revenue) * 100)
      : summary.today.revenue > 0 ? 100 : 0
    : 0;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 space-y-4">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">{restaurantName || 'POS Home'}</h1>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
              {connected ? 'Live' : 'Offline'}
            </span>
            {staffName && (
              <span className="text-xs text-muted-foreground">— {staffName}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {role === 'owner' && (
              <button
                data-testid="force-close-toggle"
                onClick={handleForceClose}
                disabled={toggling}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  forceClosed
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                } ${toggling ? 'opacity-50' : ''}`}
              >
                <Power size={12} />
                {forceClosed ? 'Online Closed' : 'Online Open'}
              </button>
            )}
            <span className="text-xs text-muted-foreground hidden sm:block">
              {todayDisplay()}
            </span>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* ── 오늘 핵심 지표 (owner만) ── */}
        {showRevenue && summary && (
          <div className="grid grid-cols-3 gap-3">
            {/* 매출 */}
            <Card className="p-3 bg-card border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Today's Revenue</span>
                <DollarSign size={14} className="text-muted-foreground" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatMoney(summary.today.revenue)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {formatMoney(summary.yesterday.revenue)}
                </span>
                {revenueTrend !== 0 && (
                  <span className={`text-xs flex items-center gap-0.5 ml-auto ${
                    revenueTrend > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {revenueTrend > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {Math.abs(revenueTrend)}%
                  </span>
                )}
              </div>
            </Card>

            {/* 주문수 */}
            <Card className="p-3 bg-card border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Today's Orders</span>
                <ShoppingBag size={14} className="text-muted-foreground" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {summary.today.orders}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Yesterday: {summary.yesterday.orders}
              </div>
            </Card>

            {/* 평균 주문 */}
            <Card className="p-3 bg-card border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg. Order</span>
                <TrendingUp size={14} className="text-muted-foreground" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatMoney(summary.avgOrderValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Tips: {formatMoney(summary.totalTips)}
              </div>
            </Card>
          </div>
        )}

        {/* ── 실시간 주문 현황 ── */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Live Orders</h2>
            <button
              onClick={() => navigate('/kds')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Open Kitchen <ArrowRight size={12} />
            </button>
          </div>
          <div className={`grid gap-3 ${counts.pendingPayment > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {counts.pendingPayment > 0 && (
              <button
                onClick={() => navigate('/cash')}
                className="flex flex-col items-center p-3 rounded-lg bg-amber-600/10 border border-amber-600/20 hover:border-amber-600/40 transition-colors animate-pulse"
              >
                <span className="text-2xl font-bold text-amber-500">{counts.pendingPayment}</span>
                <span className="text-xs text-amber-500/80 mt-0.5">Cash Due</span>
              </button>
            )}
            <button
              onClick={() => navigate('/kds')}
              className="flex flex-col items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors"
            >
              <span className="text-2xl font-bold text-amber-400">{counts.active}</span>
              <span className="text-xs text-amber-400/80 mt-0.5">Active</span>
            </button>
            <button
              onClick={() => navigate('/kds')}
              className="flex flex-col items-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
            >
              <span className="text-2xl font-bold text-purple-400">{counts.scheduled}</span>
              <span className="text-xs text-purple-400/80 mt-0.5">Scheduled</span>
            </button>
            <button
              onClick={() => navigate('/kds')}
              className={`flex flex-col items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors ${
                counts.readyDone > 0 ? 'animate-pulse' : ''
              }`}
            >
              <span className="text-2xl font-bold text-emerald-400">{counts.readyDone}</span>
              <span className="text-xs text-emerald-400/80 mt-0.5">Ready</span>
            </button>
          </div>
        </Card>

        {/* ── 빠른 네비게이션 (역할별 필터) ── */}
        <div className={`grid gap-3 ${
          showAdmin ? 'grid-cols-3' : showOrders ? 'grid-cols-2' : 'grid-cols-1'
        }`}>
          <button
            onClick={() => navigate('/kds')}
            className="p-4 bg-card border border-border rounded-xl hover:border-amber-500/40 transition-colors text-left"
          >
            <ChefHat size={24} className="text-amber-400 mb-2" />
            <div className="text-sm font-medium text-foreground">Kitchen</div>
            <div className="text-xs text-muted-foreground mt-0.5">KDS view</div>
            {counts.active > 0 && (
              <Badge className="mt-2 bg-amber-500/20 text-amber-400 border-amber-500/30" variant="outline">
                {counts.active} active
              </Badge>
            )}
          </button>

          {showOrders && (
            <button
              onClick={() => navigate('/orders')}
              className="p-4 bg-card border border-border rounded-xl hover:border-cyan-500/40 transition-colors text-left"
            >
              <ClipboardList size={24} className="text-cyan-400 mb-2" />
              <div className="text-sm font-medium text-foreground">Orders</div>
              <div className="text-xs text-muted-foreground mt-0.5">History & search</div>
            </button>
          )}

          {showAdmin && (
            <a
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-card border border-border rounded-xl hover:border-violet-500/40 transition-colors text-left"
            >
              <Settings size={24} className="text-violet-400 mb-2" />
              <div className="text-sm font-medium text-foreground">Admin</div>
              <div className="text-xs text-muted-foreground mt-0.5">Dashboard & settings</div>
            </a>
          )}
        </div>

        {/* ── 최근 주문 (manager/owner만) ── */}
        {showOrders && <Card className="bg-card border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-medium text-foreground">Recent Orders</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No recent orders
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-sm shrink-0">#{order.displayId}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {order.displayName || 'Guest'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm font-medium">{formatMoney(order.totalMoney)}</span>
                    {statusBadge(order.status)}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(order.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>}

      </div>
    </div>
  );
}
