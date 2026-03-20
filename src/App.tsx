import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { socket } from './socket';
import type { KDSOrder } from './types';
import { useKDSStore } from './stores/kdsStore';
import { useSessionStore } from './stores/sessionStore';
import { canAccess, DEFAULT_ROUTE } from './utils/roles';
import StatusBar from './components/StatusBar';
import OrderList from './components/OrderList';
import SilentPrintTicket from './components/SilentPrintTicket';
import RestaurantLogin from './components/RestaurantLogin';
import AdminPage from './components/AdminPage';
import KDSSettingsPanel from './components/KDSSettingsPanel';
import ActiveTabView from './components/ActiveTabView';
import ScheduledTabView from './components/ScheduledTabView';
import ReadyTabView from './components/ReadyTabView';
import DoneTabView from './components/DoneTabView';
import Layout from './components/Layout';
import OrdersScreen from './screens/OrdersScreen';
import DashboardScreen from './screens/DashboardScreen';
import DisplayScreen from './screens/DisplayScreen';
import HomeScreen from './screens/HomeScreen';
import ClockScreen from './screens/ClockScreen';
import CashManagementScreen from './screens/CashManagementScreen';
import CounterScreen from './screens/CounterScreen';
import { playOrderNotification } from './utils/sounds';
import { isScheduledOrder } from './utils/isScheduledOrder';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ── Kitchen (KDS) 화면 ──────────────────────────────────────────────────────
function KitchenScreen({ onUpdateStatus, onPrint, printQueue, setPrintQueue, now, onConfirmCash, onRejectCash }: {
  onUpdateStatus: (id: string, status: KDSOrder['status']) => Promise<void>;
  onPrint: (order: KDSOrder) => void;
  printQueue: KDSOrder[];
  setPrintQueue: React.Dispatch<React.SetStateAction<KDSOrder[]>>;
  now: number;
  onConfirmCash: (id: string) => Promise<void>;
  onRejectCash: (id: string) => Promise<void>;
}) {
  const { restaurantName, activeTab, setActiveTab, viewMode, setViewMode } = useSessionStore();
  const { connected, orders, scheduledActivationMinutes, orderCounts } = useKDSStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeOrders    = orders.filter((o) => o.status === 'PENDING_PAYMENT' || ((o.status === 'OPEN' || o.status === 'IN_PROGRESS') && !isScheduledOrder(o, now, scheduledActivationMinutes)));
  const scheduledOrders = orders.filter((o) => (o.status === 'OPEN' || o.status === 'IN_PROGRESS') && isScheduledOrder(o, now, scheduledActivationMinutes));
  const readyOrders     = orders.filter((o) => o.status === 'READY');
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELED');

  const counts = orderCounts();

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden font-kds">
      {/* 프린트 큐 */}
      {printQueue.length > 0 && (
        <SilentPrintTicket
          order={printQueue[0]}
          onDone={() => setPrintQueue((q) => q.slice(1))}
        />
      )}

      <KDSSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <StatusBar
        connected={connected}
        restaurantName={restaurantName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className={`flex-1 min-h-0 ${viewMode === 'list' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {viewMode === 'list' ? (
          <OrderList
            activeOrders={activeOrders}
            scheduledOrders={scheduledOrders}
            readyOrders={readyOrders}
            completedOrders={completedOrders}
            cancelledOrders={cancelledOrders}
            onUpdateStatus={onUpdateStatus}
            onPrint={onPrint}
            onConfirmCash={onConfirmCash}
            onRejectCash={onRejectCash}
          />
        ) : (
          <div className="h-full overflow-hidden flex flex-col">
            {activeTab === 'active' && (
              <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
                <ActiveTabView orders={activeOrders} scheduledOrders={scheduledOrders} now={now} scheduledActivationMinutes={scheduledActivationMinutes} onUpdateStatus={onUpdateStatus} onPrint={onPrint} onConfirmCash={onConfirmCash} onRejectCash={onRejectCash} />
              </div>
            )}
            {activeTab === 'scheduled' && (
              <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
                <ScheduledTabView
                  orders={scheduledOrders}
                  now={now}
                  scheduledActivationMinutes={scheduledActivationMinutes}
                  onUpdateStatus={onUpdateStatus}
                  onPrint={onPrint}
                />
              </div>
            )}
            {activeTab === 'ready-done' && (
              <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                <div className="flex-1 overflow-auto px-4 pb-4 pt-2 border-b sm:border-b-0 sm:border-r border-border">
                  <ReadyTabView orders={readyOrders} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                </div>
                <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
                  <DoneTabView orders={completedOrders} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
                </div>
              </div>
            )}
            {activeTab === 'cancelled' && (
              <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
                <DoneTabView orders={cancelledOrders} onUpdateStatus={onUpdateStatus} onPrint={onPrint} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 역할 기반 라우트 가드 ─────────────────────────────────────────────────────
function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const role = useSessionStore((s) => s.role);
  if (!canAccess(role, path)) {
    return <Navigate to={DEFAULT_ROUTE[role]} replace />;
  }
  return <>{children}</>;
}

// ── 로그인 후 앱 셸: Socket.io 연결 + 주문 자동 관리 ─────────────────────────
function AppShell() {
  const restaurantCode = useSessionStore((s) => s.restaurantCode)!;
  const theme = useSessionStore((s) => s.theme);
  const {
    setOrders, addOrder, updateOrderStatus, cancelOrder,
    setConnected, setMenuDisplayConfig,
    orders, scheduledActivationMinutes, autoStartOrders, autoPrint,
  } = useKDSStore();
  const [printQueue, setPrintQueue] = useState<KDSOrder[]>([]);
  const autoPrintedRef = useRef<Set<string>>(new Set());
  const autoStartedRef = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  // ── 테마 동기화 ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // 30초마다 now 갱신 → 예약 주문 자동 활성화 체크
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // 재연결 시 활성 주문 복구
  const fetchActiveOrders = async (code: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/orders/${code.toLowerCase()}/active`);
      if (!res.ok) return;
      const { orders: serverOrders }: { orders: KDSOrder[] } = await res.json();
      const currentOrders = useKDSStore.getState().orders;
      const serverIdSet = new Set(serverOrders.map((o) => o.id));
      const localOnly = currentOrders.filter((o) => !serverIdSet.has(o.id));
      setOrders([...serverOrders, ...localOnly]);
    } catch (err) {
      console.warn('[KDS] Could not fetch active orders:', err);
    }
  };

  const fetchMenuDisplayConfig = async (code: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/menu-display/${code.toLowerCase()}`);
      if (!res.ok) return;
      const data = await res.json();
      setMenuDisplayConfig(data);
    } catch (err) {
      console.warn('[KDS] Could not fetch menu display config:', err);
    }
  };

  // Socket.io 연결
  useEffect(() => {
    fetchMenuDisplayConfig(restaurantCode);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', restaurantCode.toLowerCase());
      fetchActiveOrders(restaurantCode);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('joined', ({ room }: { room: string }) => {
      console.log('[KDS] Joined room:', room);
    });
    socket.on('order:new', (order: KDSOrder) => {
      addOrder(order);
      // 소스·결제방식에 따라 다른 알림음 재생 (현금 / 배달 / 기본)
      const { soundEnabled, soundVolume } = useKDSStore.getState();
      if (soundEnabled) {
        try { playOrderNotification(order.source, soundVolume / 100, order.paymentMethod); } catch (_) {}
      }
    });
    socket.on('order:updated', (updated: Partial<KDSOrder> & { id: string }) => {
      if (updated.status) updateOrderStatus(updated.id, updated.status);
    });
    socket.on('order:cancelled', ({ id }: { id: string }) => {
      cancelOrder(id);
    });
    socket.on('menu-display:updated', (config: { menuItems: unknown[]; modifiers: unknown[] }) => {
      setMenuDisplayConfig(config as Parameters<typeof setMenuDisplayConfig>[0]);
    });

    if (socket.connected) {
      setConnected(true);
      socket.emit('join', restaurantCode.toLowerCase());
      fetchActiveOrders(restaurantCode);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joined');
      socket.off('order:new');
      socket.off('order:updated');
      socket.off('order:cancelled');
      socket.off('menu-display:updated');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantCode]);

  const handleUpdateStatus = async (orderId: string, status: KDSOrder['status']) => {
    try {
      await fetch(`${SERVER_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, restaurantCode }),
      });
      updateOrderStatus(orderId, status);
    } catch (err) {
      console.error('Failed to update order status', err);
    }
  };

  // 자동시작: OPEN 비예약 주문 즉시 IN_PROGRESS
  useEffect(() => {
    if (!autoStartOrders) return;
    const toStart = orders.filter(
      (o) => o.status === 'OPEN' && !isScheduledOrder(o, Date.now(), scheduledActivationMinutes) && !autoStartedRef.current.has(o.id)
    );
    toStart.forEach((o) => {
      autoStartedRef.current.add(o.id);
      handleUpdateStatus(o.id, 'IN_PROGRESS');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, autoStartOrders]);

  // 예약 주문 자동 활성화 (30초마다 체크)
  useEffect(() => {
    const toActivate = orders.filter(
      (o) =>
        o.status === 'OPEN' &&
        o.pickupAt &&
        !isScheduledOrder(o, now, scheduledActivationMinutes) &&
        !autoStartedRef.current.has(o.id)
    );
    toActivate.forEach((o) => {
      autoStartedRef.current.add(o.id);
      handleUpdateStatus(o.id, 'IN_PROGRESS');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // autoPrint 켤 때 기존 IN_PROGRESS 주문을 이미 프린트된 것으로 마킹
  useEffect(() => {
    if (autoPrint) {
      orders.forEach((o) => {
        if (o.status === 'IN_PROGRESS') autoPrintedRef.current.add(o.id);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  // 자동 프린트: IN_PROGRESS 전환 시 자동 출력
  useEffect(() => {
    if (!autoPrint) return;
    const toPrint = orders.filter(
      (o) => o.status === 'IN_PROGRESS' && !autoPrintedRef.current.has(o.id)
    );
    if (toPrint.length > 0) {
      toPrint.forEach((o) => autoPrintedRef.current.add(o.id));
      setPrintQueue((q) => [...q, ...toPrint]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const handlePrint = (order: KDSOrder) => {
    setPrintQueue((q) => [...q, order]);
  };

  const handleConfirmCash = async (orderId: string, cashTendered?: number, cashChange?: number) => {
    try {
      await fetch(`${SERVER_URL}/api/orders/${orderId}/confirm-cash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantCode, cashTendered, cashChange }),
      });
      updateOrderStatus(orderId, 'OPEN');
    } catch (err) {
      console.error('Failed to confirm cash payment', err);
    }
  };

  const handleRejectCash = async (orderId: string) => {
    try {
      await fetch(`${SERVER_URL}/api/orders/${orderId}/reject-cash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantCode }),
      });
      cancelOrder(orderId);
    } catch (err) {
      console.error('Failed to reject cash order', err);
    }
  };

  return (
    <Routes>
      {/* Display: 풀스크린, 사이드바 없음 */}
      <Route path="/display" element={<RoleGuard path="/display"><DisplayScreen /></RoleGuard>} />

      {/* Admin: 자체 PIN 인증 있으므로 역할 가드 불필요 */}
      <Route path="/admin" element={<AdminPage />} />

      {/* 메인 레이아웃 (사이드바 포함) */}
      <Route element={<Layout />}>
        <Route index element={<RoleGuard path="/"><HomeScreen /></RoleGuard>} />
        <Route path="/kds" element={
          <RoleGuard path="/kds">
            <KitchenScreen
              onUpdateStatus={handleUpdateStatus}
              onPrint={handlePrint}
              printQueue={printQueue}
              setPrintQueue={setPrintQueue}
              now={now}
              onConfirmCash={handleConfirmCash}
              onRejectCash={handleRejectCash}
            />
          </RoleGuard>
        } />
        <Route path="/counter" element={
          <RoleGuard path="/counter">
            <CounterScreen
              onUpdateStatus={handleUpdateStatus}
              onConfirmCash={handleConfirmCash}
              onRejectCash={handleRejectCash}
            />
          </RoleGuard>
        } />
        <Route path="/clock" element={<RoleGuard path="/clock"><ClockScreen /></RoleGuard>} />
        <Route path="/orders" element={<RoleGuard path="/orders"><OrdersScreen /></RoleGuard>} />
        <Route path="/cash" element={<RoleGuard path="/cash"><CashManagementScreen /></RoleGuard>} />
        <Route path="/dashboard" element={<RoleGuard path="/dashboard"><DashboardScreen /></RoleGuard>} />
      </Route>
    </Routes>
  );
}

// ── 메인 앱 ──────────────────────────────────────────────────────────────────
export default function App() {
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const login = useSessionStore((s) => s.login);

  // 로그인 화면은 항상 다크
  useEffect(() => {
    if (!restaurantCode) {
      document.documentElement.classList.add('dark');
    }
  }, [restaurantCode]);

  if (!restaurantCode) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<RestaurantLogin onJoin={login} />} />
      </Routes>
    );
  }

  return <AppShell />;
}
