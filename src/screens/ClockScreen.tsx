import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Delete, CheckCircle2, LogIn, LogOut, Clock, ArrowLeft, Users, RefreshCw } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { todayStr, todayDisplay } from '../utils/timezone';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface ClockResult {
  staff: { id: string; name: string };
  action: 'clock_in' | 'clock_out';
  entry: {
    id: string;
    clock_in: string;
    clock_out: string | null;
  };
  voided_entry?: {
    id: string;
    clock_in: string;
  };
}

interface MyHoursEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  pay_hours: number | null;
}

interface MyHoursData {
  staff: { id: string; name: string; hourly_wage: number };
  entries: MyHoursEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(clockIn: string, clockOut: string) {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function calcWorkedHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClockScreen() {
  const restaurantCode = useSessionStore((s) => s.restaurantCode)!;
  const restaurantName = useSessionStore((s) => s.restaurantName);
  const role = useSessionStore((s) => s.role);
  const [showClockPad, setShowClockPad] = useState(role !== 'owner');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<ClockResult | null>(null);
  const [lastPin, setLastPin] = useState(''); // PIN 기억 (View My Hours 용)
  const [myHours, setMyHours] = useState<MyHoursData | null>(null);
  const [myHoursLoading, setMyHoursLoading] = useState(false);

  // 결과 표시 후 10초 뒤 자동 리셋 (View My Hours 누를 시간 확보)
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setResult(null);
      setPin('');
      setLastPin('');
    }, 10000);
    return () => clearTimeout(timer);
  }, [result]);

  const handleClock = useCallback(async (enteredPin: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/clock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });

      if (res.ok) {
        const data: ClockResult = await res.json();
        setResult(data);
        setLastPin(enteredPin);
      } else if (res.status === 401) {
        setError('Invalid PIN');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin('');
      } else {
        setError('Server error. Please try again.');
        setPin('');
      }
    } catch {
      setError('Cannot connect to server.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [restaurantCode]);

  // 4자리 입력 시 자동 제출
  useEffect(() => {
    if (pin.length === 4) {
      handleClock(pin);
    }
  }, [pin, handleClock]);

  const handleDigit = (digit: string) => {
    if (pin.length < 4 && !loading) {
      setError('');
      setPin((p) => p + digit);
    }
  };

  const handleBackspace = () => {
    if (!loading) {
      setPin((p) => p.slice(0, -1));
      setError('');
    }
  };

  const handleClear = () => {
    if (!loading) {
      setPin('');
      setError('');
    }
  };

  // View My Hours
  const handleViewMyHours = async () => {
    if (!lastPin) return;
    setMyHoursLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/my-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: lastPin }),
      });
      if (res.ok) {
        const data: MyHoursData = await res.json();
        setMyHours(data);
        setResult(null); // 결과 화면 닫기
      }
    } catch {
      setError('Cannot load hours.');
    } finally {
      setMyHoursLoading(false);
    }
  };

  const handleBackToPin = () => {
    setMyHours(null);
    setResult(null);
    setPin('');
    setLastPin('');
  };

  // 키보드 입력 지원
  useEffect(() => {
    if (result || myHours) return; // 결과/My Hours 화면에서는 키 입력 무시
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const dots = Array.from({ length: 4 }, (_, i) => (
    <div
      key={i}
      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
        i < pin.length
          ? 'bg-primary border-primary scale-110'
          : 'border-muted-foreground/40'
      }`}
    />
  ));

  const digitBtn = (digit: string) => (
    <button
      key={digit}
      type="button"
      onClick={() => handleDigit(digit)}
      disabled={loading}
      className="w-16 h-16 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 text-xl font-bold text-foreground transition-all disabled:opacity-50"
    >
      {digit}
    </button>
  );

  // ── My Hours 화면 ──────────────────────────────────────────────────────────
  if (myHours) {
    // 최근 2주 엔트리만 필터 (서버에서 전체를 주지만 화면에서는 최근 것만)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const recentEntries = myHours.entries
      .filter((e) => new Date(e.clock_in) >= twoWeeksAgo)
      .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());

    const totalHours = recentEntries.reduce((sum, e) => {
      const h = e.pay_hours ?? calcWorkedHours(e.clock_in, e.clock_out);
      return sum + h;
    }, 0);

    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{myHours.staff.name}</CardTitle>
                <CardDescription>Recent 2 weeks · {formatMoney(myHours.staff.hourly_wage)}/hr</CardDescription>
              </div>
              <button
                onClick={handleBackToPin}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No entries in the last 2 weeks.</p>
            ) : (
              <div className="overflow-y-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-1.5 pr-2">Date</th>
                      <th className="text-left py-1.5 pr-2">In</th>
                      <th className="text-left py-1.5 pr-2">Out</th>
                      <th className="text-right py-1.5">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map((e) => {
                      const hours = e.pay_hours ?? calcWorkedHours(e.clock_in, e.clock_out);
                      return (
                        <tr key={e.id} className="border-b border-border/50">
                          <td className="py-1.5 pr-2">{formatDate(e.clock_in)}</td>
                          <td className="py-1.5 pr-2">{formatTime(e.clock_in)}</td>
                          <td className="py-1.5 pr-2">
                            {e.clock_out ? formatTime(e.clock_out) : <span className="text-amber-500">Active</span>}
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {e.clock_out ? hours.toFixed(1) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="py-2 text-right pr-4">Total</td>
                      <td className="py-2 text-right">{totalHours.toFixed(1)}h</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <button
              type="button"
              onClick={handleBackToPin}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 결과 표시 화면 ────────────────────────────────────────────────────────
  if (result) {
    const isClockIn = result.action === 'clock_in';
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isClockIn ? 'bg-emerald-500/20' : 'bg-blue-500/20'
            }`}>
              {isClockIn
                ? <LogIn size={32} className="text-emerald-500" />
                : <LogOut size={32} className="text-blue-500" />
              }
            </div>

            <div>
              <p className="text-2xl font-bold">{result.staff.name}</p>
              <p className={`text-lg font-semibold mt-1 flex items-center justify-center gap-1.5 ${
                isClockIn ? 'text-emerald-500' : 'text-blue-500'
              }`}>
                <CheckCircle2 size={18} />
                {isClockIn ? 'Clocked In' : 'Clocked Out'}
              </p>
            </div>

            <div className="text-sm text-muted-foreground space-y-0.5">
              {isClockIn ? (
                <p>Started at {formatTime(result.entry.clock_in)}</p>
              ) : (
                <>
                  <p>{formatTime(result.entry.clock_in)} → {formatTime(result.entry.clock_out!)}</p>
                  <p className="font-medium text-foreground">
                    Worked: {formatDuration(result.entry.clock_in, result.entry.clock_out!)}
                  </p>
                </>
              )}
              {result.voided_entry && (
                <p className="text-amber-500 text-xs mt-1">Previous incomplete shift was voided</p>
              )}
            </div>

            {/* View My Hours 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewMyHours}
              disabled={myHoursLoading}
              className="mt-2 gap-1.5"
            >
              <Clock size={14} />
              {myHoursLoading ? 'Loading...' : 'View My Hours'}
            </Button>

            <button
              type="button"
              onClick={() => { setResult(null); setPin(''); setLastPin(''); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Tap to continue
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Owner: 직원 출퇴근 현황 ──────────────────────────────────────────────
  if (role === 'owner' && !showClockPad) {
    return (
      <>
        <TodayStaffView
          restaurantCode={restaurantCode}
          onShowClockPad={() => setShowClockPad(true)}
        />
        <style>{shakeStyle}</style>
      </>
    );
  }

  // ── PIN 입력 화면 ─────────────────────────────────────────────────────────
  return (
    <div className="h-full flex items-center justify-center p-4">
      <Card className="w-full max-w-xs">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">{restaurantName}</CardTitle>
          <CardDescription>Enter your PIN to clock in/out</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5">
          {/* PIN dots */}
          <div className={`flex gap-3 py-2 ${shake ? 'animate-shake' : ''}`}>
            {dots}
          </div>

          {/* Error */}
          {error && (
            <p className="text-destructive text-sm -mt-2">{error}</p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digitBtn)}
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              className="w-16 h-16 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 text-sm font-semibold text-muted-foreground transition-all disabled:opacity-50"
            >
              CLR
            </button>
            {digitBtn('0')}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={loading}
              className="w-16 h-16 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 flex items-center justify-center text-muted-foreground transition-all disabled:opacity-50"
            >
              <Delete size={20} />
            </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse">Processing...</div>
          )}

          {/* Current time + back to staff view for owner */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-muted-foreground">
              {todayDisplay()}
            </p>
            {role === 'owner' && (
              <button
                type="button"
                onClick={() => { setShowClockPad(false); setPin(''); setError(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                ← Back to Staff Overview
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <style>{shakeStyle}</style>
    </div>
  );
}

// ── Shake animation style ──────────────────────────────────────────────────
const shakeStyle = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }
  .animate-shake { animation: shake 0.4s ease-in-out; }
`;

// ── Today Staff View (Owner) ────────────────────────────────────────────────

interface StaffEntry {
  id: string;
  staff_id: string;
  staff_name: string;
  clock_in: string;
  clock_out: string | null;
  pay_hours: number | null;
}

function TodayStaffView({ restaurantCode, onShowClockPad }: {
  restaurantCode: string;
  onShowClockPad: () => void;
}) {
  const sessionPin = useSessionStore((s) => s.pin);
  const [entries, setEntries] = useState<StaffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!sessionPin) return;
    setLoading(true);
    try {
      const today = todayStr();
      const res = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/time-entries?pin=${encodeURIComponent(sessionPin)}&from=${today}&to=${today}`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      console.error('[Clock] Failed to load staff entries');
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, sessionPin]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Group entries by staff
  const staffGroups = entries.reduce<Record<string, { name: string; entries: StaffEntry[] }>>((acc, e) => {
    if (!acc[e.staff_id]) acc[e.staff_id] = { name: e.staff_name, entries: [] };
    acc[e.staff_id].entries.push(e);
    return acc;
  }, {});

  const activeCount = entries.filter((e) => !e.clock_out).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users size={20} /> Today's Clock
            </h1>
            <p className="text-xs text-muted-foreground">
              {todayDisplay({ weekday: 'long', month: 'long', day: 'numeric' })}
              {activeCount > 0 && <span className="ml-2 text-emerald-500">● {activeCount} active</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchEntries()}>
              <RefreshCw size={14} />
            </Button>
            <Button size="sm" onClick={onShowClockPad} className="gap-1.5">
              <Clock size={14} /> Clock In/Out
            </Button>
          </div>
        </div>

        {/* Staff entries */}
        {Object.keys(staffGroups).length === 0 ? (
          <Card className="p-8 bg-card border-border text-center">
            <p className="text-muted-foreground">No clock entries today</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(staffGroups).map(([staffId, { name, entries: staffEntries }]) => {
              const isActive = staffEntries.some((e) => !e.clock_out);
              const totalHours = staffEntries.reduce((sum, e) => {
                return sum + (e.pay_hours ?? calcWorkedHours(e.clock_in, e.clock_out));
              }, 0);

              return (
                <Card key={staffId} className="p-4 bg-card border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{name}</span>
                      {isActive && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {totalHours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="space-y-1">
                    {staffEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          {formatTime(e.clock_in)}
                          {e.clock_out ? ` → ${formatTime(e.clock_out)}` : ''}
                        </span>
                        <span>
                          {e.clock_out
                            ? formatDuration(e.clock_in, e.clock_out)
                            : <span className="text-emerald-500">Clocked in</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
