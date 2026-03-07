import { X } from 'lucide-react';
import { useState } from 'react';
import { useKDSStore } from '../stores/kdsStore';

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
    sectionSeparation, setSectionSeparation,
    autoStartOrders, setAutoStartOrders,
    inStoreSplitPct, setInStoreSplitPct,
  } = useKDSStore();

  const [activationInput, setActivationInput] = useState(String(scheduledActivationMinutes));

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

          {/* Section separation */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Section Separation</p>
              <p className="text-xs text-muted-foreground mt-0.5">Split IN-STORE and PICKUP areas</p>
            </div>
            <Toggle checked={sectionSeparation} onChange={() => setSectionSeparation(!sectionSeparation)} />
          </div>

          {/* IN-STORE section height slider (only when section separation is ON) */}
          {sectionSeparation && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">IN-STORE Height</span>
                <span className="text-sm font-black tabular-nums text-primary">{inStoreSplitPct}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={inStoreSplitPct}
                onChange={(e) => setInStoreSplitPct(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More IN-STORE ↑</span>
                <span>More PICKUP ↑</span>
              </div>
              <p className="text-xs text-muted-foreground">
                You can also drag the divider directly on the screen.
              </p>
            </div>
          )}

          <div className="h-px bg-border/60" />

          {/* Auto-start orders */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Auto-Start Orders</p>
              <p className="text-xs text-muted-foreground mt-0.5">Move new orders to IN PROGRESS immediately</p>
            </div>
            <Toggle checked={autoStartOrders} onChange={() => setAutoStartOrders(!autoStartOrders)} />
          </div>

        </div>
      </div>
    </>
  );
}
