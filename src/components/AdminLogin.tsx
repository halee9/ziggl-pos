import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RestaurantConfig } from './AdminPage';

interface Props {
  onLogin: (config: RestaurantConfig, pin: string) => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedPin = pin.trim();
    if (!trimmedCode || !trimmedPin) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${serverUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, pin: trimmedPin }),
      });

      if (res.status === 404) { setError('Restaurant code not found.'); return; }
      if (res.status === 401) { setError('Incorrect PIN.'); return; }
      if (!res.ok) { setError('Server error. Please try again.'); return; }

      const config = await res.json();
      onLogin(config, trimmedPin);
    } catch {
      setError('Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">⚙️</div>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>Enter your restaurant code and PIN</CardDescription>
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
                className="text-center text-xl font-bold tracking-widest"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin">Settings PIN</Label>
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                maxLength={8}
                className="text-center text-xl tracking-widest"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button type="submit" disabled={!code.trim() || !pin.trim() || loading} className="w-full">
              {loading ? 'Verifying...' : 'Login'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            <a href="/" className="hover:text-foreground transition-colors">← Back to POS</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
