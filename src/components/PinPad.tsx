import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Delete } from 'lucide-react';
import type { PosRole } from '../types';

interface Props {
  restaurantName: string;
  restaurantCode: string;
  serverUrl: string;
  onVerified: (role: PosRole, staffName: string, pin: string) => void;
  onBack: () => void;
}

export default function PinPad({ restaurantName, restaurantCode, serverUrl, onVerified, onBack }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const verifyPin = useCallback(async (enteredPin: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${serverUrl}/api/config/${restaurantCode}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });

      if (res.ok) {
        const data = await res.json();
        onVerified(data.role as PosRole, data.name, enteredPin);
      } else if (res.status === 401) {
        setError('Incorrect PIN');
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
  }, [serverUrl, restaurantCode, onVerified]);

  // 4자리 입력 시 자동 제출
  useEffect(() => {
    if (pin.length === 4) {
      verifyPin(pin);
    }
  }, [pin, verifyPin]);

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

  // 키보드 입력 지원
  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xs">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">{restaurantName}</CardTitle>
          <CardDescription>Enter your staff PIN</CardDescription>
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
            <div className="text-sm text-muted-foreground animate-pulse">Verifying...</div>
          )}

          {/* Back link */}
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Change restaurant
          </button>
        </CardContent>
      </Card>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
