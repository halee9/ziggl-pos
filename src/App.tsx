import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { socket } from './socket';
import type { KDSOrder } from './types';
import { useKDSStore } from './stores/kdsStore';
import { useSessionStore } from './stores/sessionStore';
import OrderCard from './components/OrderCard';
import OrderList from './components/OrderList';
import StatusBar from './components/StatusBar';
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
    filteredOrders, orderCounts,
    filter, setFilter,
    connected,
  } = useKDSStore();

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

  const filtered = filteredOrders();
  const counts = orderCounts();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {printOrder && <PrintTicket order={printOrder} />}

      <StatusBar
        connected={connected}
        restaurantName={restaurantName}
        orderCounts={counts}
        filter={filter}
        onFilterChange={setFilter}
        onLogout={handleLogout}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="no-print px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Kitchen Display</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} orders</span>
      </div>

      <div className="flex-1 px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="text-5xl mb-4">🍽️</div>
            <div className="text-lg">No orders yet</div>
          </div>
        ) : viewMode === 'list' ? (
          <OrderList
            orders={filtered}
            onUpdateStatus={handleUpdateStatus}
            onPrint={handlePrint}
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(order => (
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
