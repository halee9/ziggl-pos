import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ChefHat, ShoppingBag, Clock, ClipboardList, Banknote, Monitor, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useKDSStore } from '../stores/kdsStore';
import { getVisibleNavPaths, getVisibleBottomItems } from '../utils/roles';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  action?: 'navigate' | 'window' | 'logout';
  badge?: number;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useSessionStore((s) => s.logout);
  const role = useSessionStore((s) => s.role);
  const staffName = useSessionStore((s) => s.staffName);
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);
  const setOrders = useKDSStore((s) => s.setOrders);
  const counts = useKDSStore((s) => s.orderCounts)();

  const handleLogout = () => {
    logout();
    setOrders([]);
  };

  // 역할별 상단 네비게이션 필터
  const visiblePaths = new Set(getVisibleNavPaths(role));
  const allNavItems: NavItem[] = [
    { icon: <Home size={22} />, label: 'Home', path: '/' },
    { icon: <ChefHat size={22} />, label: 'Kitchen', path: '/kds', badge: counts.active },
    { icon: <ShoppingBag size={22} />, label: 'Counter', path: '/counter', badge: counts.pendingPayment },
    { icon: <Clock size={22} />, label: 'Clock', path: '/clock' },
    { icon: <ClipboardList size={22} />, label: 'Orders', path: '/orders' },
    { icon: <Banknote size={22} />, label: 'Cash', path: '/cash', badge: counts.pendingPayment },
  ];
  const navItems = allNavItems.filter((item) => visiblePaths.has(item.path));

  // 역할별 하단 항목 필터
  const visibleBottom = getVisibleBottomItems(role);
  const allBottomItems: NavItem[] = [
    { icon: <Monitor size={22} />, label: 'Display', path: '/display', action: 'window' },
    { icon: <Settings size={22} />, label: 'Admin', path: '/admin', action: 'window' },
    { icon: <LogOut size={22} />, label: 'Logout', path: '', action: 'logout' },
  ];
  const bottomItems = allBottomItems.filter((item) => visibleBottom.has(item.label));

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleClick = (item: NavItem) => {
    if (item.action === 'logout') {
      handleLogout();
    } else if (item.action === 'window') {
      window.open(item.path, 'ziggl-display', 'popup');
    } else {
      navigate(item.path);
    }
  };

  return (
    <div className="no-print h-screen w-[60px] flex flex-col items-center py-3 bg-card border-r border-border flex-shrink-0">
      {/* Top nav */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleClick(item)}
            className={`group relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${
              isActive(item.path)
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {item.icon}
            {/* Badge */}
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold px-1">
                {item.badge}
              </span>
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg border border-border z-50">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Staff name */}
      {staffName && (
        <div className="mb-1 w-11 flex items-center justify-center">
          <span className="text-[9px] font-medium text-muted-foreground truncate w-full text-center leading-tight">
            {staffName}
          </span>
        </div>
      )}

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="group relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50 mb-1"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        <span className="absolute left-full ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg border border-border z-50">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </span>
      </button>

      {/* Bottom nav */}
      <nav className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            onClick={() => handleClick(item)}
            className={`group relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${
              item.action !== 'logout' && isActive(item.path)
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {item.icon}
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg border border-border z-50">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
