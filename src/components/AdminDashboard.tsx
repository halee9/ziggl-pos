import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { RestaurantConfig } from './AdminPage';
import MenuDisplayEditor from './MenuDisplayEditor';
import { useKDSStore } from '../stores/kdsStore';

type TabKey = 'settings' | 'menu-display';

interface Props {
  config: RestaurantConfig;
  pin: string;
  onSaved: (updated: RestaurantConfig) => void;
  onLogout: () => void;
}

export default function AdminDashboard({ config, pin, onSaved, onLogout }: Props) {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const {
    scheduledActivationMinutes, setScheduledActivationMinutes,
    sectionSeparation, setSectionSeparation,
    autoStartOrders, setAutoStartOrders,
  } = useKDSStore();
  const [activationInput, setActivationInput] = useState(String(scheduledActivationMinutes));

  const [name, setName] = useState(config.name);
  const [taxRate, setTaxRate] = useState((config.tax_rate * 100).toFixed(2));
  const [tipPercentages, setTipPercentages] = useState(config.tip_percentages.join(', '));
  const [enableTipping, setEnableTipping] = useState(config.enable_tipping);
  const [sessionTimeout, setSessionTimeout] = useState(String(config.session_timeout_minutes));
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const parsedTips = tipPercentages.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    if (parsedTips.length === 0) { setErrorMsg('Tip percentages must be comma-separated numbers'); return; }

    const parsedTaxRate = parseFloat(taxRate);
    if (isNaN(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100) { setErrorMsg('Tax rate must be 0–100'); return; }

    const parsedTimeout = parseInt(sessionTimeout, 10);
    if (isNaN(parsedTimeout) || parsedTimeout < 1) { setErrorMsg('Session timeout must be at least 1 minute'); return; }

    let effectivePin = pin;
    if (newPin) {
      if (newPin !== confirmPin) { setErrorMsg('New PINs do not match'); return; }
      if (newPin.length < 4) { setErrorMsg('PIN must be at least 4 characters'); return; }
      effectivePin = newPin;
    }

    setSaving(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/${config.restaurant_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          name: name.trim(),
          tax_rate: parsedTaxRate / 100,
          tip_percentages: parsedTips,
          enable_tipping: enableTipping,
          session_timeout_minutes: parsedTimeout,
          settings_pin: effectivePin,
        }),
      });

      if (!res.ok) { const d = await res.json(); setErrorMsg(d.error || 'Failed to save'); return; }

      const updated = await res.json();
      setSuccessMsg('Settings saved!');
      setNewPin('');
      setConfirmPin('');
      onSaved(updated);
    } catch {
      setErrorMsg('Cannot connect to server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">⚙️ Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{config.restaurant_code.toUpperCase()} · {config.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← KDS</a>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs">Logout</Button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border px-6">
        <div className="flex gap-1">
          {([
            { key: 'settings', label: '⚙️ Settings' },
            { key: 'menu-display', label: '🎨 Menu Display' },
          ] as { key: TabKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">

        {/* Menu Display 탭 */}
        {activeTab === 'menu-display' && (
          <MenuDisplayEditor restaurantCode={config.restaurant_code} pin={pin} />
        )}

        {/* Settings 탭 */}
        {activeTab === 'settings' && (
        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* Restaurant Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Restaurant Info</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Restaurant Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Square Location ID</Label>
                <Input value={config.square_location_id} disabled className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Contact admin to change Square settings</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Payment Settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax">Tax Rate (%)</Label>
                <Input id="tax" type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} step="0.01" min="0" max="100" required />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Enable Tipping</p>
                  <p className="text-xs text-muted-foreground">Show tip options at checkout</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableTipping(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${enableTipping ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enableTipping ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {enableTipping && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tips">Tip Percentages (comma-separated)</Label>
                  <Input id="tips" value={tipPercentages} onChange={e => setTipPercentages(e.target.value)} placeholder="15, 18, 20, 25" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kiosk Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Kiosk Settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <Label htmlFor="timeout">Session Timeout (minutes)</Label>
              <Input id="timeout" type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} min="1" max="60" required />
              <p className="text-xs text-muted-foreground">Kiosk resets to menu after this many minutes of inactivity</p>
            </CardContent>
          </Card>

          {/* Change PIN */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Change PIN</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newpin">New PIN (leave blank to keep current)</Label>
                <Input id="newpin" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN" maxLength={8} />
              </div>
              {newPin && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmpin">Confirm New PIN</Label>
                  <Input id="confirmpin" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirm PIN" maxLength={8} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* KDS Settings (localStorage 저장 — 서버 전송 불필요) */}
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider">KDS Settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activation">예약 주문 활성화 (분 전)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="activation"
                    type="number"
                    min={5}
                    max={120}
                    value={activationInput}
                    onChange={(e) => setActivationInput(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const v = parseInt(activationInput, 10);
                      if (!isNaN(v) && v >= 5 && v <= 120) setScheduledActivationMinutes(v);
                    }}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  픽업 시간 N분 전부터 Kitchen 탭 메인에 표시. 이전까지는 Upcoming 스트립에 대기. (기본값: 20분)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">리스트뷰 섹션 분리</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    IN-STORE / PICKUP & DELIVERY 구역 분리 (기본값: ON)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sectionSeparation}
                  onClick={() => setSectionSeparation(!sectionSeparation)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                    ${sectionSeparation ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
                    ${sectionSeparation ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">주문 자동 시작</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    새 주문 수신 시 즉시 IN_PROGRESS 처리 (기본값: ON)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoStartOrders}
                  onClick={() => setAutoStartOrders(!autoStartOrders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                    ${autoStartOrders ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
                    ${autoStartOrders ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {errorMsg && <p className="text-destructive text-sm text-center">{errorMsg}</p>}
          {successMsg && <p className="text-green-400 text-sm text-center">{successMsg}</p>}

          <Button type="submit" disabled={saving} size="lg" className="w-full">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
        )}
      </div>
    </div>
  );
}
