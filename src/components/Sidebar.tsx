import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ChefHat, ShoppingBag, Clock, ClipboardList, Banknote, Monitor, Settings, LogOut, Sun, Moon, KeyRound } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useKDSStore } from '../stores/kdsStore';
import { getVisibleNavPaths, getVisibleBottomItems } from '../utils/roles';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

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
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const sessionPin = useSessionStore((s) => s.pin);
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);
  const setOrders = useKDSStore((s) => s.setOrders);
  const counts = useKDSStore((s) => s.orderCounts)();

  // PIN change dialog state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const handleLogout = () => {
    logout();
    setOrders([]);
  };

  const handlePinChange = async () => {
    setPinError('');
    if (currentPin !== sessionPin) { setPinError('Current PIN is incorrect'); return; }
    if (newPin.length < 4) { setPinError('New PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setPinError('New PINs do not match'); return; }
    setPinSaving(true);
    try {
      const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      // Find staff by name to get ID
      const listRes = await fetch(`${SERVER}/api/staff/${restaurantCode}`);
      const staffList = await listRes.json();
      const me = staffList.find((s: { name: string }) => s.name === staffName);
      if (!me) { setPinError('Staff not found'); setPinSaving(false); return; }
      const res = await fetch(`${SERVER}/api/staff/${restaurantCode}/${me.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_pin: newPin }),
      });
      if (!res.ok) throw new Error('Failed to update PIN');
      // Update session pin
      useSessionStore.setState({ pin: newPin });
      setPinDialogOpen(false);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch {
      setPinError('Failed to save. Try again.');
    } finally {
      setPinSaving(false);
    }
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

      {/* Change PIN */}
      {staffName && (
        <button
          onClick={() => { setPinDialogOpen(true); setPinError(''); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }}
          className="group relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50 mb-1"
        >
          <KeyRound size={20} />
          <span className="absolute left-full ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg border border-border z-50">
            Change PIN
          </span>
        </button>
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
      {/* PIN Change Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Current PIN</Label>
              <Input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="Current PIN" maxLength={8} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>New PIN</Label>
              <Input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New PIN" maxLength={8} />
            </div>
            {newPin && (
              <div className="flex flex-col gap-1.5">
                <Label>Confirm New PIN</Label>
                <Input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN" maxLength={8} />
              </div>
            )}
            {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            <Button onClick={handlePinChange} disabled={pinSaving || !currentPin || !newPin}>
              {pinSaving ? 'Saving...' : 'Update PIN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
