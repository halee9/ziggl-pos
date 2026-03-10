import { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { socket } from './socket';
import type { KDSOrder } from './types';
import { useKDSStore } from './stores/kdsStore';
import { useSessionStore } from './stores/sessionStore';
import StatusBar from './components/StatusBar';
import SilentPrintTicket from './components/SilentPrintTicket';
import RestaurantLogin from './components/RestaurantLogin';
import AdminPage from './components/AdminPage';
import KDSSettingsPanel from './components/KDSSettingsPanel';
import ActiveTabView from './components/ActiveTabView';
import ScheduledTabView from './components/ScheduledTabView';
import ReadyTabView from './components/ReadyTabView';
import DoneTabView from './components/DoneTabView';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function KDSApp() {
  const { restaurantCode, restaurantName, login, logout, activeTab, setActiveTab } = useSessionStore();
  const {
    setOrders, addOrder, updateOrderStatus, cancelOrder,
    setConnected,
    setMenuDisplayConfig,
    connected,
    orders,
    scheduledActivationMinutes,
    autoStartOrders,
    autoPrint,
    orderCounts,
  } = useKDSStore();
  const [printQueue, setPrintQueue] = useState<KDSOrder[]>([]);
  const autoPrintedRef = useRef<Set<string>>(new Set());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  // 메뉴 표시 설정 로딩
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

  useEffect(() => {
    if (!restaurantCode) return;

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
      try { new Audio('/notification.mp3').play(); } catch (_) {}
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

  // ── 자동시작: OPEN 비예약 주문 즉시 IN_PROGRESS ─────────────────────────────
  const autoStartedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!autoStartOrders || !restaurantCode) return;
    const toStart = orders.filter(
      (o) => o.status === 'OPEN' && !o.isScheduled && !autoStartedRef.current.has(o.id)
    );
    toStart.forEach((o) => {
      autoStartedRef.current.add(o.id);
      handleUpdateStatus(o.id, 'IN_PROGRESS');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, autoStartOrders]);

  // ── 예약 주문 자동 활성화 (30초마다 체크) ────────────────────────────────────
  useEffect(() => {
    if (!restaurantCode) return;
    const toActivate = orders.filter(
      (o) =>
        o.status === 'OPEN' &&
        o.isScheduled &&
        (new Date(o.pickupAt).getTime() - now) / 60_000 <= scheduledActivationMinutes &&
        !autoStartedRef.current.has(o.id)
    );
    toActivate.forEach((o) => {
      autoStartedRef.current.add(o.id);
      handleUpdateStatus(o.id, 'IN_PROGRESS');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const handlePrint = (order: KDSOrder) => {
    setPrintQueue((q) => [...q, order]);
  };

  // ── 자동 프린트: IN_PROGRESS 전환 시 자동 출력 ─────────────────────────────
  useEffect(() => {
    if (!autoPrint || !restaurantCode) return;
    const toPrint = orders.filter(
      (o) => o.status === 'IN_PROGRESS' && !autoPrintedRef.current.has(o.id)
    );
    if (toPrint.length > 0) {
      toPrint.forEach((o) => autoPrintedRef.current.add(o.id));
      setPrintQueue((q) => [...q, ...toPrint]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, autoPrint, restaurantCode]);

  const handleLogout = () => {
    logout();
    setOrders([]);
  };

  if (!restaurantCode) {
    return <RestaurantLogin onJoin={login} />;
  }

  // ── 주문 분류 ──────────────────────────────────────────────────
  const activeOrders    = orders.filter((o) => (o.status === 'OPEN' && !o.isScheduled) || o.status === 'IN_PROGRESS');
  const scheduledOrders = orders.filter((o) => o.status === 'OPEN' && o.isScheduled);
  const readyOrders     = orders.filter((o) => o.status === 'READY');
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');

  const counts = orderCounts();

  return (
    <div className="h-screen flex flex-col bg-background max-w-[1024px] mx-auto overflow-hidden">
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
        onLogout={handleLogout}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'active' && (
          <ActiveTabView
            orders={activeOrders}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        )}
        {activeTab === 'scheduled' && (
          <ScheduledTabView
            orders={scheduledOrders}
            now={now}
            scheduledActivationMinutes={scheduledActivationMinutes}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        )}
        {activeTab === 'ready' && (
          <ReadyTabView
            orders={readyOrders}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        )}
        {activeTab === 'done' && (
          <DoneTabView
            orders={completedOrders}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/*" element={<KDSApp />} />
    </Routes>
  );
}
