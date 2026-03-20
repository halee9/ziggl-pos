import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PinPad from './PinPad';
import type { PosRole } from '../types';

interface Props {
  onJoin: (code: string, name: string, role?: PosRole, staffName?: string, pin?: string, timezone?: string) => void;
}

export default function RestaurantLogin({ onJoin }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2단계: PIN 입력
  const [step, setStep] = useState<'code' | 'pin'>('code');
  const [pendingConfig, setPendingConfig] = useState<{ code: string; name: string; timezone: string } | null>(null);

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${serverUrl}/api/config/${trimmed}`);
      if (!res.ok) {
        setError('Restaurant code not found. Please check and try again.');
        return;
      }
      const config = await res.json();

      if (config.hasPosRoles) {
        // PIN 필요 — 2단계로 전환
        setPendingConfig({ code: trimmed, name: config.name, timezone: config.timezone ?? 'America/Los_Angeles' });
        setStep('pin');
      } else {
        // PIN 없음 — 바로 owner로 진입 (기존 동작)
        localStorage.setItem('kds_restaurant_code', trimmed);
        localStorage.setItem('kds_restaurant_name', config.name);
        onJoin(trimmed, config.name, undefined, undefined, undefined, config.timezone ?? 'America/Los_Angeles');
      }
    } catch {
      setError('Cannot connect to server. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // PIN 입력 화면
  if (step === 'pin' && pendingConfig) {
    return (
      <PinPad
        restaurantName={pendingConfig.name}
        restaurantCode={pendingConfig.code}
        serverUrl={serverUrl}
        onVerified={(role, staffName, pin) => {
          localStorage.setItem('kds_restaurant_code', pendingConfig.code);
          localStorage.setItem('kds_restaurant_name', pendingConfig.name);
          onJoin(pendingConfig.code, pendingConfig.name, role, staffName, pin, pendingConfig.timezone);
        }}
        onBack={() => {
          setStep('code');
          setPendingConfig(null);
        }}
      />
    );
  }

  // 코드 입력 화면 (기존)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🍽️</div>
          <CardTitle>Ziggl POS</CardTitle>
          <CardDescription>Enter your restaurant code to start</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Restaurant Code</Label>
              <Input
                id="code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MIDORI"
                maxLength={8}
                autoFocus
                className="text-center text-2xl font-bold tracking-widest h-14"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button type="submit" disabled={!code.trim() || loading} className="w-full">
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
