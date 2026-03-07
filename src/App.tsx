import { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { socket } from './socket';
import type { KDSOrder } from './types';
import { useKDSStore } from './stores/kdsStore';
import { useSessionStore } from './stores/sessionStore';
import OrderCard from './components/OrderCard';
import OrderList from './components/OrderList';
import StatusBar from './components/StatusBar';
import PendingStrip from './components/PendingStrip';
import PrintTicket from './components/PrintTicket';
import RestaurantLogin from './components/RestaurantLogin';
import AdminPage from './components/AdminPage';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function KDSApp() {
  const { restaurantCode, restaurantName, login, logout, viewMode, setViewMode } = useSessionStore();
  const {
    printOrder,
    setOrders, addOrder, updateOrderStatus, cancelOrder,
    setConnected, setPrintOrder,
    setMenuDisplayConfig,
    connected,
    orders,
    scheduledActivationMinutes,
    autoStartOrders,
  } = useKDSStore();

  const [activeTab, setActiveTab] = useState<'kitchen' | 'done'>('kitchen');
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
      const { orders: activeOrders } = await res.json();
      setOrders(activeOrders);
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

    // 로그인 시 메뉴 표시 설정 로드
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
  // useRef로 이미 처리한 주문 추적 (중복 실행 방지)
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
    setPrintOrder(order);
    setTimeout(() => { window.print(); setPrintOrder(null); }, 100);
  };

  const handleLogout = () => {
    logout();
    setOrders([]);
  };

  if (!restaurantCode) {
    return <RestaurantLogin onJoin={login} />;
  }

  // ── 주문 분류 ──────────────────────────────────────────────────
  const minutesUntil = (pickupAt: string) =>
    (new Date(pickupAt).getTime() - now) / 60_000;

  // 왼쪽 패널: 조리 중인 주문만
  const activeOrders = orders.filter((o) => o.status === 'IN_PROGRESS');

  // 오른쪽 패널 상단: 미시작 주문 (OPEN — 비예약 + 예약 대기)
  const incomingOrders = orders.filter((o) => o.status === 'OPEN');

  // 오른쪽 패널 하단: 완료된 주문 (READY + COMPLETED)
  const doneOrders = orders.filter((o) =>
    o.status === 'READY' || o.status === 'COMPLETED'
  );

  // 카드뷰 예약 대기 스트립용 (픽업까지 아직 여유 있는 예약 주문)
  const pendingOrders = orders.filter((o) =>
    o.status === 'OPEN' &&
    o.isScheduled &&
    minutesUntil(o.pickupAt) > scheduledActivationMinutes
  );

  // 카드뷰에서 표시할 주문 목록
  const displayOrders = activeTab === 'kitchen'
    ? orders.filter((o) => o.status === 'OPEN' || o.status === 'IN_PROGRESS')
    : doneOrders;

  return (
    <div className="min-h-screen flex flex-col bg-background max-w-[1024px] mx-auto">
      {printOrder && <PrintTicket order={printOrder} />}

      <StatusBar
        connected={connected}
        restaurantName={restaurantName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        kitchenCount={activeOrders.length}
        pendingCount={incomingOrders.length}
        doneCount={doneOrders.length}
        onLogout={handleLogout}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 예약 대기 스트립 (Kitchen 탭, 대기 주문 있을 때만) */}
      {activeTab === 'kitchen' && pendingOrders.length > 0 && (
        <PendingStrip orders={pendingOrders} now={now} />
      )}

      <div className={`flex-1 min-h-0 ${viewMode === 'list' ? 'overflow-hidden' : 'px-4 pb-4 overflow-auto'}`}>
        {viewMode === 'list' ? (
          <OrderList
            activeOrders={activeOrders}
            incomingOrders={incomingOrders}
            doneOrders={doneOrders}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="text-5xl mb-4">🍽️</div>
            <div className="text-lg">
              {activeTab === 'kitchen' ? 'No active orders' : 'No completed orders'}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onPrint={handlePrint}
              />
            ))}
          </div>
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
