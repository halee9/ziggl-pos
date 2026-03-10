import { X } from 'lucide-react';
import { useState } from 'react';
import { useKDSStore } from '../stores/kdsStore';

// 긴급도 단계 표시용
const URGENCY_ROWS = [
  { dot: 'bg-green-500',  label: 'Normal',   desc: '0 min (always)',          editable: false },
  { dot: 'bg-yellow-400', label: 'Warning',  desc: '',                         editable: true,  key: 'yellow' as const },
  { dot: 'bg-orange-400', label: 'Alert',    desc: '',                         editable: true,  key: 'orange' as const },
  { dot: 'bg-red-500',    label: 'Critical', desc: '+ pulsing animation',      editable: true,  key: 'red'    as const },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-primary' : 'bg-white/20'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function KDSSettingsPanel({ open, onClose }: Props) {
  const {
    scheduledActivationMinutes, setScheduledActivationMinutes,
    autoStartOrders, setAutoStartOrders,
    autoPrint, setAutoPrint,
    urgencyYellowMin, setUrgencyYellowMin,
    urgencyOrangeMin, setUrgencyOrangeMin,
    urgencyRedMin,    setUrgencyRedMin,
  } = useKDSStore();

  const [activationInput, setActivationInput] = useState(String(scheduledActivationMinutes));

  // 긴급도 임계값 로컬 입력 상태
  const [urgencyInputs, setUrgencyInputs] = useState({
    yellow: String(urgencyYellowMin),
    orange: String(urgencyOrangeMin),
    red:    String(urgencyRedMin),
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Slide panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 bg-card border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-bold text-base">KDS Settings</span>
          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Settings items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

          {/* Scheduled order activation */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Scheduled Order Activation</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={120}
                value={activationInput}
                onChange={(e) => setActivationInput(e.target.value)}
                className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-center tabular-nums"
              />
              <span className="text-sm text-muted-foreground">min before</span>
              <button
                className="ml-auto text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-semibold hover:opacity-80 transition-opacity"
                onClick={() => {
                  const v = parseInt(activationInput, 10);
                  if (!isNaN(v) && v >= 5 && v <= 120) setScheduledActivationMinutes(v);
                }}
              >
                Apply
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Show scheduled orders N minutes before pickup time. (Default: 20 min)
            </p>
          </div>

          <div className="h-px bg-border/60" />

          {/* Auto-start orders */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Auto-Start Orders</p>
              <p className="text-xs text-muted-foreground mt-0.5">Move new orders to IN PROGRESS immediately</p>
            </div>
            <Toggle checked={autoStartOrders} onChange={() => setAutoStartOrders(!autoStartOrders)} />
          </div>

          <div className="h-px bg-border/60" />

          {/* Auto-print */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Auto Print</p>
              <p className="text-xs text-muted-foreground mt-0.5">Print order ticket when order starts</p>
            </div>
            <Toggle checked={autoPrint} onChange={() => setAutoPrint(!autoPrint)} />
          </div>

          <div className="h-px bg-border/60" />

          {/* Urgency Color Thresholds */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold">Order Urgency Colors</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Color changes when cooking time exceeds threshold
              </p>
            </div>

            {/* 컬러 테이블 */}
            <div className="flex flex-col gap-1.5">
              {URGENCY_ROWS.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-sm">
                  {/* 색상 도트 */}
                  <span className={`w-3 h-3 rounded-full shrink-0 ${row.dot}`} />
                  {/* 라벨 */}
                  <span className="w-16 font-semibold shrink-0">{row.label}</span>
                  {/* 입력 or 고정 */}
                  {row.editable ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={urgencyInputs[row.key]}
                        onChange={(e) =>
                          setUrgencyInputs((prev) => ({ ...prev, [row.key]: e.target.value }))
                        }
                        className="w-14 bg-background border border-border rounded px-2 py-0.5 text-sm text-center tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.desc}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              className="self-start text-xs px-3 py-1 rounded bg-primary text-primary-foreground font-semibold hover:opacity-80 transition-opacity"
              onClick={() => {
                const y = parseInt(urgencyInputs.yellow, 10);
                const o = parseInt(urgencyInputs.orange, 10);
                const r = parseInt(urgencyInputs.red,    10);
                if (isNaN(y) || isNaN(o) || isNaN(r)) return;
                if (y < 1 || o <= y || r <= o) return; // 순서 검증
                setUrgencyYellowMin(y);
                setUrgencyOrangeMin(o);
                setUrgencyRedMin(r);
              }}
            >
              Apply
            </button>
            <p className="text-xs text-muted-foreground -mt-1">
              Values must be in ascending order (e.g. 5 → 10 → 15)
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
