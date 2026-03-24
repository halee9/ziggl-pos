import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAdminStore } from '../../stores/adminStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const LOGO_OPTIONS = [
  { key: 'ginkgo', label: 'Ginkgo',   emoji: '🌿', bg: '#14532d', desc: 'Japanese ginkgo leaf'    },
  { key: 'sakura', label: 'Sakura',   emoji: '🌸', bg: '#881337', desc: 'Cherry blossom'          },
  { key: 'flame',  label: 'Flame',    emoji: '🔥', bg: '#7c2d12', desc: 'Fire · BBQ · Grill'      },
  { key: 'bowl',   label: 'Bowl',     emoji: '🍚', bg: '#2e1065', desc: 'Rice bowl & chopsticks'  },
  { key: 'star',   label: 'Star',     emoji: '⭐', bg: '#1c1a06', desc: 'Classic restaurant star' },
  { key: 'mono',   label: 'Monogram', emoji: '🔤', bg: '#334155', desc: 'Restaurant initials'     },
] as const;

export default function AdminSettingsPage() {
  const config = useAdminStore((s) => s.config)!;
  const pin = useAdminStore((s) => s.pin);
  const updateConfig = useAdminStore((s) => s.updateConfig);

  const [logoStyle, setLogoStyle] = useState(config.logo_style ?? 'mono');
  const [name, setName] = useState(config.name);
  const [taxRate, setTaxRate] = useState((config.tax_rate * 100).toFixed(2));
  const [tipPercentages, setTipPercentages] = useState(config.tip_percentages.join(', '));
  const [enableTipping, setEnableTipping] = useState(config.enable_tipping);
  const [sessionTimeout, setSessionTimeout] = useState(String(config.session_timeout_minutes));
  const [enableCashPayment, setEnableCashPayment] = useState(config.enable_cash_payment ?? false);
  const [enableCoinCounting, setEnableCoinCounting] = useState(config.enable_coin_counting ?? false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [managerPin, setManagerPin] = useState(config.manager_pin ?? '');
  const [staffPin, setStaffPin] = useState(config.staff_pin ?? '');
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
      const res = await fetch(`${SERVER_URL}/api/admin/${config.restaurant_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          name: name.trim(),
          tax_rate: parsedTaxRate / 100,
          tip_percentages: parsedTips,
          enable_tipping: enableTipping,
          enable_cash_payment: enableCashPayment,
          enable_coin_counting: enableCoinCounting,
          session_timeout_minutes: parsedTimeout,
          settings_pin: effectivePin,
          manager_pin: managerPin.trim() || null,
          staff_pin: staffPin.trim() || null,
          logo_style: logoStyle,
        }),
      });

      if (!res.ok) { const d = await res.json(); setErrorMsg(d.error || 'Failed to save'); return; }

      const updated = await res.json();
      setSuccessMsg('Settings saved!');
      setNewPin('');
      setConfirmPin('');
      updateConfig(updated);
    } catch {
      setErrorMsg('Cannot connect to server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <h2 className="text-lg font-bold mb-4">Settings</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Restaurant Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Restaurant Info</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Restaurant Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Square Location ID</Label>
              <Input value={config.square_location_id} disabled className="text-muted-foreground h-11" />
              <p className="text-xs text-muted-foreground">Contact admin to change Square settings</p>
            </div>

            {/* Receipt Logo */}
            <div className="flex flex-col gap-2">
              <Label>Receipt Logo Style</Label>
              <div className="flex gap-2 flex-wrap">
                {LOGO_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    title={opt.desc}
                    onClick={() => setLogoStyle(opt.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border-2 transition-all ${
                      logoStyle === opt.key
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style={{ background: opt.bg }}
                    >
                      {opt.emoji}
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-none">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Shown on the customer receipt page</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Payment Settings</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax">Tax Rate (%)</Label>
              <Input id="tax" type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} step="0.01" min="0" max="100" required className="h-11" />
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
                <Input id="tips" value={tipPercentages} onChange={e => setTipPercentages(e.target.value)} placeholder="15, 18, 20, 25" className="h-11" />
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Enable Cash Payment</p>
                <p className="text-xs text-muted-foreground">Allow customers to pay with cash</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableCashPayment(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${enableCashPayment ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enableCashPayment ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {enableCashPayment && (
              <div className="flex items-center justify-between py-1 pl-4 border-l-2 border-border">
                <div>
                  <p className="text-sm font-medium">Enable Coin Counting</p>
                  <p className="text-xs text-muted-foreground">Include coins in daily cash reconciliation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableCoinCounting(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${enableCoinCounting ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enableCoinCounting ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kiosk Settings */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Kiosk Settings</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Label htmlFor="timeout">Session Timeout (minutes)</Label>
            <Input id="timeout" type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} min="1" max="60" required className="h-11" />
            <p className="text-xs text-muted-foreground">Kiosk resets to menu after this many minutes of inactivity</p>
          </CardContent>
        </Card>

        {/* POS PINs */}
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">POS Access PINs</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerpin">Owner PIN (leave blank to keep current)</Label>
              <Input id="ownerpin" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Current owner PIN unchanged" maxLength={8} className="h-11" />
            </div>
            {newPin && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmpin">Confirm Owner PIN</Label>
                <Input id="confirmpin" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirm PIN" maxLength={8} className="h-11" />
              </div>
            )}
            <Separator />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="managerpin">Manager PIN</Label>
              <Input id="managerpin" value={managerPin} onChange={e => setManagerPin(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 2011" maxLength={8} className="h-11" />
              <p className="text-xs text-muted-foreground">Used for manager login & refund authorization</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staffpin">Staff PIN</Label>
              <Input id="staffpin" value={staffPin} onChange={e => setStaffPin(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 1234" maxLength={8} className="h-11" />
              <p className="text-xs text-muted-foreground">Used for staff login</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {errorMsg && <p className="text-destructive text-sm text-center">{errorMsg}</p>}
        {successMsg && <p className="text-green-500 text-sm text-center">{successMsg}</p>}

        <Button type="submit" disabled={saving} size="lg" className="w-full h-12">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
