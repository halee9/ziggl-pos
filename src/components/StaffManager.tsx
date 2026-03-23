import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Printer,
  UserCheck, UserX, Phone, Mail, CalendarCog,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ── Types ────────────────────────────────────────────────────────────────────

interface Staff {
  id: string;
  restaurant_code: string;
  name: string;
  phone: string;
  email: string;
  is_active: boolean;
  hire_date: string;
  hourly_wage: number; // cents
  tip_percent: number; // 0~100
  min_hourly_wage: number; // cents
  pin: string;
  created_at: string;
  updated_at: string;
}

interface TimeEntryRow {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  pay_hours: number | null;
  note: string;
  staff_name: string;
  hourly_wage: number;
  tip_percent: number;
  min_hourly_wage: number;
}

type SubTab = 'staff' | 'payroll';

interface Props {
  restaurantCode: string;
  restaurantName: string;
  pin: string;
  payPeriodStart: string | null; // YYYY-MM-DD or null
  onPayPeriodStartSaved: (date: string | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
}

function calcWorkedHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function roundToHalf(h: number): number {
  return Math.round(h * 2) / 2;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/**
 * 2주 pay period 계산.
 * referenceStart: 기준 시작일 (YYYY-MM-DD). 이 날짜부터 2주 단위로 반복.
 * 없으면 이번 주 일요일 기준 fallback.
 */
function getPayPeriod(offset: number, referenceStart: string | null): { from: Date; to: Date; label: string } {
  let anchor: Date;
  if (referenceStart) {
    // Parse YYYY-MM-DD as local date
    const [y, m, d] = referenceStart.split('-').map(Number);
    anchor = new Date(y, m - 1, d);
  } else {
    // Fallback: this week's Sunday
    const now = new Date();
    anchor = new Date(now);
    anchor.setDate(now.getDate() - now.getDay());
  }
  anchor.setHours(0, 0, 0, 0);

  // Find the current period: how many 14-day blocks since anchor?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - anchor.getTime()) / 86_400_000);
  const periodIndex = Math.floor(diffDays / 14);

  // Apply offset
  const start = new Date(anchor);
  start.setDate(start.getDate() + (periodIndex + offset) * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);

  const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
  const label = `${start.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' })}`;
  return { from: start, to: end, label };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StaffManager({ restaurantCode, restaurantName, pin, payPeriodStart, onPayPeriodStartSaved }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('staff');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Staff CRUD ─────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formHireDate, setFormHireDate] = useState('');
  const [formWage, setFormWage] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formTipPercent, setFormTipPercent] = useState('0');
  const [formMinWage, setFormMinWage] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // ── Payroll ────────────────────────────────────────────────────────────────
  const [periodOffset, setPeriodOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editPayHours, setEditPayHours] = useState('');
  const [periodTips, setPeriodTips] = useState(0); // cents
  const [payrollNotes, setPayrollNotes] = useState<Record<string, string>>({}); // staffId → note
  const [finalizedMap, setFinalizedMap] = useState<Record<string, string>>({}); // staffId → finalized_at

  // ── Edit time entry dialog ─────────────────────────────────────────────────
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [editEntryId, setEditEntryId] = useState('');
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editEntryClockIn, setEditEntryClockIn] = useState('');
  const [editEntryClockOut, setEditEntryClockOut] = useState('');
  const [editEntryPayHours, setEditEntryPayHours] = useState('');
  const [editEntrySaving, setEditEntrySaving] = useState(false);
  const [showPeriodConfig, setShowPeriodConfig] = useState(false);
  const [periodStartInput, setPeriodStartInput] = useState(payPeriodStart ?? '');
  const [periodStartSaving, setPeriodStartSaving] = useState(false);

  // ── Manual time entry ──────────────────────────────────────────────────────
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualStaffId, setManualStaffId] = useState('');
  const [manualStaffName, setManualStaffName] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualClockIn, setManualClockIn] = useState('07:00');
  const [manualClockOut, setManualClockOut] = useState('16:00');
  const [manualSaving, setManualSaving] = useState(false);

  const handleSavePeriodStart = async () => {
    setPeriodStartSaving(true);
    try {
      const value = periodStartInput || null;
      const res = await fetch(`${SERVER_URL}/api/admin/${restaurantCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, pay_period_start: value }),
      });
      if (!res.ok) throw new Error('Failed');
      onPayPeriodStartSaved(value);
      setShowPeriodConfig(false);
      setPeriodOffset(0);
    } catch {
      setError('Failed to save pay period start');
    } finally {
      setPeriodStartSaving(false);
    }
  };

  // ── Fetch staff ────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}?pin=${encodeURIComponent(pin)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setStaffList(data.staff);
    } catch {
      setError('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, pin]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── Fetch time entries ─────────────────────────────────────────────────────
  const period = getPayPeriod(periodOffset, payPeriodStart);

  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
      const from = period.from.toLocaleDateString('en-CA', { timeZone: tz });
      const to = period.to.toLocaleDateString('en-CA', { timeZone: tz });
      const res = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/time-entries?pin=${encodeURIComponent(pin)}&from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setEntries(data.entries);

      // Fetch period tips
      const tipsRes = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/period-tips?pin=${encodeURIComponent(pin)}&from=${from}&to=${to}`
      );
      if (tipsRes.ok) {
        const tipsData = await tipsRes.json();
        setPeriodTips(tipsData.totalTips ?? 0);
      }

      // Fetch payroll notes
      const notesRes = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/payroll-notes?pin=${encodeURIComponent(pin)}&from=${from}&to=${to}`
      );
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        const noteMap: Record<string, string> = {};
        const finMap: Record<string, string> = {};
        for (const n of notesData.notes) {
          noteMap[n.staff_id] = n.note;
          if (n.finalized_at) finMap[n.staff_id] = n.finalized_at;
        }
        setPayrollNotes(noteMap);
        setFinalizedMap(finMap);
      }
    } catch {
      setError('Failed to load time entries');
    } finally {
      setEntriesLoading(false);
    }
  }, [restaurantCode, pin, period.from.getTime(), period.to.getTime()]);

  useEffect(() => {
    if (subTab === 'payroll') fetchEntries();
  }, [subTab, fetchEntries]);

  // ── Staff dialog handlers ──────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingStaff(null);
    setFormName(''); setFormPhone(''); setFormEmail('');
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    setFormHireDate(new Date().toLocaleDateString('en-CA', { timeZone: tz }));
    setFormWage(''); setFormPin(''); setFormTipPercent('0'); setFormMinWage(''); setFormActive(true);
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (s: Staff) => {
    setEditingStaff(s);
    setFormName(s.name); setFormPhone(s.phone); setFormEmail(s.email);
    setFormHireDate(s.hire_date); setFormWage((s.hourly_wage / 100).toFixed(2));
    setFormPin(s.pin); setFormTipPercent(String(s.tip_percent ?? 0));
    setFormMinWage(s.min_hourly_wage ? (s.min_hourly_wage / 100).toFixed(2) : '');
    setFormActive(s.is_active);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!formName.trim()) { setFormError('Name is required'); return; }
    if (!formPin.trim() || formPin.length < 4) { setFormError('PIN must be at least 4 digits'); return; }

    setFormSaving(true);
    setFormError('');
    try {
      const payload = {
        pin,  // admin auth
        staff_pin: formPin.trim(),  // staff's own PIN
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        hire_date: formHireDate,
        hourly_wage: Math.round(parseFloat(formWage || '0') * 100),
        tip_percent: parseInt(formTipPercent || '0', 10),
        min_hourly_wage: Math.round(parseFloat(formMinWage || '0') * 100),
        is_active: formActive,
      };

      if (editingStaff) {
        const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/${editingStaff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          setFormError(d.error || 'Failed to update');
          return;
        }
      } else {
        const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          setFormError(d.error || 'Failed to create');
          return;
        }
      }

      setDialogOpen(false);
      fetchStaff();
    } catch {
      setFormError('Cannot connect to server');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Delete staff member "${name}"? This will also delete all their time entries.`)) return;
    try {
      const res = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/${id}?pin=${encodeURIComponent(pin)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed');
      fetchStaff();
    } catch {
      setError('Failed to delete staff');
    }
  };

  // ── Pay hours inline edit ──────────────────────────────────────────────────
  const handleSavePayHours = async (entryId: string) => {
    try {
      const val = editPayHours.trim() === '' ? null : parseFloat(editPayHours);
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/time-entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, pay_hours: val }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditingEntry(null);
      fetchEntries();
    } catch {
      setError('Failed to update pay hours');
    }
  };

  // ── Payroll finalize ─────────────────────────────────────────────────────
  const handleFinalize = async (staffId: string, totalHours: number, basePay: number, tipShare: number, topUp: number, grossPay: number) => {
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    const from = period.from.toLocaleDateString('en-CA', { timeZone: tz });
    const to = period.to.toLocaleDateString('en-CA', { timeZone: tz });
    try {
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/payroll-finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin, staff_id: staffId, period_start: from, period_end: to,
          total_hours: totalHours, base_pay: basePay, tip_share: tipShare,
          top_up: topUp, gross_pay: grossPay, note: payrollNotes[staffId] ?? '',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setFinalizedMap(prev => ({ ...prev, [staffId]: data.payroll.finalized_at }));
    } catch {
      setError('Failed to finalize payroll');
    }
  };

  // ── Payroll note save ────────────────────────────────────────────────────
  const handleSaveNote = async (staffId: string, note: string) => {
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    const from = period.from.toLocaleDateString('en-CA', { timeZone: tz });
    const to = period.to.toLocaleDateString('en-CA', { timeZone: tz });
    try {
      await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/payroll-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, staff_id: staffId, period_start: from, period_end: to, note }),
      });
    } catch {
      // silent fail
    }
  };

  // ── Edit time entry dialog ───────────────────────────────────────────────
  const openEditEntry = (e: TimeEntryRow) => {
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    setEditEntryId(e.id);
    setEditEntryDate(new Date(e.clock_in).toLocaleDateString('en-CA', { timeZone: tz }));
    setEditEntryClockIn(new Date(e.clock_in).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }));
    setEditEntryClockOut(e.clock_out
      ? new Date(e.clock_out).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
      : ''
    );
    setEditEntryPayHours(e.pay_hours != null ? e.pay_hours.toFixed(2) : '');
    setEditEntryOpen(true);
  };

  const handleSaveEditEntry = async () => {
    if (!editEntryDate || !editEntryClockIn) return;
    setEditEntrySaving(true);
    try {
      const clockInISO = new Date(`${editEntryDate}T${editEntryClockIn}:00`).toISOString();
      const clockOutISO = editEntryClockOut
        ? new Date(`${editEntryDate}T${editEntryClockOut}:00`).toISOString()
        : null;
      const payHours = editEntryPayHours.trim() === '' ? null : parseFloat(editEntryPayHours);

      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/time-entries/${editEntryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, clock_in: clockInISO, clock_out: clockOutISO, pay_hours: payHours }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditEntryOpen(false);
      fetchEntries();
    } catch {
      setError('Failed to update time entry');
    } finally {
      setEditEntrySaving(false);
    }
  };

  // ── Delete time entry ────────────────────────────────────────────────────
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return;
    try {
      const res = await fetch(
        `${SERVER_URL}/api/staff/${restaurantCode}/time-entries/${entryId}?pin=${encodeURIComponent(pin)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed');
      fetchEntries();
    } catch {
      setError('Failed to delete time entry');
    }
  };

  // ── Manual time entry ────────────────────────────────────────────────────
  const openManualEntry = (staffId: string, staffName: string) => {
    setManualStaffId(staffId);
    setManualStaffName(staffName);
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    setManualDate(new Date().toLocaleDateString('en-CA', { timeZone: tz }));
    setManualClockIn('07:00');
    setManualClockOut('16:00');
    setManualEntryOpen(true);
  };

  const handleSaveManualEntry = async () => {
    if (!manualDate || !manualClockIn || !manualClockOut) return;
    setManualSaving(true);
    try {
      const clockInISO = new Date(`${manualDate}T${manualClockIn}:00`).toISOString();
      const clockOutISO = new Date(`${manualDate}T${manualClockOut}:00`).toISOString();
      const res = await fetch(`${SERVER_URL}/api/staff/${restaurantCode}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, staff_id: manualStaffId, clock_in: clockInISO, clock_out: clockOutISO }),
      });
      if (!res.ok) throw new Error('Failed');
      setManualEntryOpen(false);
      fetchEntries();
    } catch {
      setError('Failed to create time entry');
    } finally {
      setManualSaving(false);
    }
  };

  // ── Print pay stub ─────────────────────────────────────────────────────────
  const [printStaffId, setPrintStaffId] = useState<string | null>(null);

  const handlePrint = (staffId?: string) => {
    setPrintStaffId(staffId ?? null);
    const tz = useSessionStore.getState().timezone || 'America/Los_Angeles';
    const periodEnd = period.to.toLocaleDateString('en-CA', { timeZone: tz });
    // Set document title for PDF filename
    const origTitle = document.title;
    setTimeout(() => {
      if (staffId && entriesByStaff[staffId]) {
        document.title = `${entriesByStaff[staffId].name} ${periodEnd}`;
      } else {
        document.title = `Pay Stubs ${periodEnd}`;
      }
      window.print();
      document.title = origTitle;
    }, 50);
  };

  // ── Group entries by staff for payroll ─────────────────────────────────────
  const entriesByStaff = entries.reduce<Record<string, { name: string; wage: number; tipPercent: number; minWage: number; entries: TimeEntryRow[] }>>((acc, e) => {
    if (!acc[e.staff_id]) acc[e.staff_id] = { name: e.staff_name, wage: e.hourly_wage, tipPercent: e.tip_percent ?? 0, minWage: e.min_hourly_wage ?? 0, entries: [] };
    acc[e.staff_id].entries.push(e);
    return acc;
  }, {});

  // Tip distribution: weighted by (payHours × tipPercent)
  const staffTipData = Object.entries(entriesByStaff).map(([staffId, { tipPercent, entries: staffEntries }]) => {
    const totalPayHours = staffEntries.reduce((sum, e) => {
      if (e.pay_hours != null) return sum + e.pay_hours;
      return sum + roundToHalf(calcWorkedHours(e.clock_in, e.clock_out));
    }, 0);
    return { staffId, tipPercent, totalPayHours, weighted: totalPayHours * tipPercent };
  });
  const totalWeighted = staffTipData.reduce((sum, d) => sum + d.weighted, 0);
  const tipShareMap: Record<string, number> = {};
  for (const d of staffTipData) {
    tipShareMap[d.staffId] = totalWeighted > 0 && d.tipPercent > 0
      ? Math.round((d.weighted / totalWeighted) * periodTips)
      : 0;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-6 no-print">
        {([
          { key: 'staff' as SubTab, label: 'Staff List' },
          { key: 'payroll' as SubTab, label: 'Payroll' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              subTab === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive text-sm mb-4 no-print">{error}</p>}

      {/* ═══════════════════════ Staff List ═══════════════════════ */}
      {subTab === 'staff' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Staff Members ({staffList.filter(s => showInactive || s.is_active).length})</h2>
            <div className="flex items-center gap-2">
              <button
                className={`text-xs px-2 py-1 rounded ${showInactive ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? 'Hide' : 'Show'} Inactive
              </button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus size={16} className="mr-1" /> Add Staff
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm animate-pulse">Loading...</p>
          ) : staffList.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No staff members yet. Click "Add Staff" to get started.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {staffList.filter(s => showInactive || s.is_active).map((s) => (
                <Card key={s.id} className={`${!s.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        s.is_active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'
                      }`}>
                        {s.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          {!s.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {s.phone && <span className="flex items-center gap-0.5"><Phone size={10} />{s.phone}</span>}
                          {s.email && <span className="flex items-center gap-0.5"><Mail size={10} />{s.email}</span>}
                          <span>PIN: {s.pin}</span>
                          <span>{formatMoney(s.hourly_wage)}/hr</span>
                          {s.tip_percent > 0 && <span className="text-amber-500">Tip {s.tip_percent}%</span>}
                          {s.min_hourly_wage > 0 && <span className="text-blue-400">Min {formatMoney(s.min_hourly_wage)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(s)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteStaff(s.id, s.name)} className="text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ Payroll ═══════════════════════ */}
      {subTab === 'payroll' && (
        <div className="space-y-4">
          {/* Period navigator */}
          <div className="flex items-center justify-between no-print">
            <Button variant="outline" size="sm" onClick={() => setPeriodOffset(o => o - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{period.label}</p>
              <button
                onClick={() => { setShowPeriodConfig(v => !v); setPeriodStartInput(payPeriodStart ?? ''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Configure pay period start date"
              >
                <CalendarCog size={14} />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPeriodOffset(o => o + 1)} disabled={periodOffset >= 0}>
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Pay period start config */}
          {showPeriodConfig && (
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg text-sm no-print">
              <Label htmlFor="pp-start" className="whitespace-nowrap text-xs">Pay Period Start</Label>
              <Input
                id="pp-start"
                type="date"
                value={periodStartInput}
                onChange={(e) => setPeriodStartInput(e.target.value)}
                className="w-40 h-8 text-sm"
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleSavePeriodStart} disabled={periodStartSaving}>
                {periodStartSaving ? 'Saving...' : 'Save'}
              </Button>
              <button onClick={() => setShowPeriodConfig(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          )}

          {entriesLoading ? (
            <p className="text-muted-foreground text-sm animate-pulse">Loading...</p>
          ) : Object.keys(entriesByStaff).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No time entries for this period.</CardContent></Card>
          ) : (
            <>
              {Object.entries(entriesByStaff).map(([staffId, { name, wage, tipPercent, minWage, entries: staffEntries }]) => {
                const totalWorked = staffEntries.reduce((sum, e) => sum + calcWorkedHours(e.clock_in, e.clock_out), 0);
                const totalPayHours = staffEntries.reduce((sum, e) => {
                  if (e.pay_hours != null) return sum + e.pay_hours;
                  return sum + roundToHalf(calcWorkedHours(e.clock_in, e.clock_out));
                }, 0);
                const basePay = Math.round(totalPayHours * wage);
                const tipShare = tipShareMap[staffId] ?? 0;
                const minPay = minWage > 0 ? Math.round(totalPayHours * minWage) : 0;
                const isMinApplied = minWage > 0 && minPay > basePay + tipShare;
                const grossPay = isMinApplied ? minPay : basePay + tipShare;

                return (
                  <Card key={staffId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{name}</CardTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground no-print">
                          {tipPercent > 0 && <span className="text-amber-500">Tip {tipPercent}%</span>}
                          <span>{formatMoney(wage)}/hr</span>
                          {minWage > 0 && <span className="text-blue-400">Min {formatMoney(minWage)}/hr</span>}
                          <button
                            onClick={() => handlePrint(staffId)}
                            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Print pay stub"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => openManualEntry(staffId, name)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Add time entry"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th className="py-1.5 pr-3">Date</th>
                              <th className="py-1.5 pr-3">Clock In</th>
                              <th className="py-1.5 pr-3">Clock Out</th>
                              <th className="py-1.5 pr-3">Worked</th>
                              <th className="py-1.5 pr-3">Pay Hours</th>
                              <th className="py-1.5 w-8 no-print"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffEntries
                              .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
                              .map((e) => {
                                const worked = calcWorkedHours(e.clock_in, e.clock_out);
                                const payH = e.pay_hours ?? roundToHalf(worked);
                                const isEditing = editingEntry === e.id;
                                const isVoided = e.clock_out && e.clock_out === e.clock_in && e.pay_hours === 0;
                                return (
                                  <tr key={e.id} className={`border-b border-border/50 ${isVoided ? 'opacity-40' : ''}`}>
                                    <td className="py-1.5 pr-3">{formatDate(e.clock_in)}</td>
                                    <td className="py-1.5 pr-3">{formatTime(e.clock_in)}</td>
                                    <td className="py-1.5 pr-3">
                                      {isVoided ? (
                                        <span className="text-destructive text-xs">Voided</span>
                                      ) : e.clock_out ? formatTime(e.clock_out) : (
                                        <span className="text-amber-500">Active</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-3">{e.clock_out && !isVoided ? formatHours(worked) : '—'}</td>
                                    <td className="py-1.5 pr-3">
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          value={editPayHours}
                                          onChange={(ev) => setEditPayHours(ev.target.value)}
                                          onKeyDown={(ev) => {
                                            if (ev.key === 'Enter') handleSavePayHours(e.id);
                                            if (ev.key === 'Escape') setEditingEntry(null);
                                          }}
                                          onBlur={() => handleSavePayHours(e.id)}
                                          autoFocus
                                          className="w-20 h-7 text-sm"
                                        />
                                      ) : (
                                        <span className={e.pay_hours != null ? 'font-semibold text-primary' : ''}>
                                          {payH.toFixed(2)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 w-8 no-print">
                                      {!isVoided && (
                                        <button
                                          onClick={() => openEditEntry(e)}
                                          className="text-muted-foreground hover:text-foreground transition-colors"
                                          title="Edit entry"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      )}
                                      {(isVoided || !e.clock_out) && (
                                        <button
                                          onClick={() => handleDeleteEntry(e.id)}
                                          className="text-destructive/60 hover:text-destructive transition-colors"
                                          title="Delete entry"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                          <tfoot>
                            <tr className="font-semibold text-sm">
                              <td colSpan={3} className="py-2 text-right font-bold pr-6">Total</td>
                              <td className="py-2 pr-3">{formatHours(totalWorked)}</td>
                              <td className="py-2 pr-3">{totalPayHours.toFixed(2)}</td>
                              <td></td>
                            </tr>
                            <tr className="text-sm">
                              <td colSpan={3} className="pb-2 pr-3 text-right text-muted-foreground">Base Pay</td>
                              <td colSpan={2} className="pb-2 pr-3 font-semibold">{formatMoney(basePay)}</td>
                              <td></td>
                            </tr>
                            {tipShare > 0 && (
                              <tr className="text-sm">
                                <td colSpan={3} className="pb-1 pr-3 text-right text-amber-500">Tips</td>
                                <td colSpan={2} className="pb-1 pr-3 font-semibold text-amber-500">{formatMoney(tipShare)}</td>
                                <td></td>
                              </tr>
                            )}
                            {tipShare > 0 && (
                              <tr className="text-sm">
                                <td colSpan={3} className="pb-1 pr-3 text-right text-muted-foreground">Base + Tips</td>
                                <td colSpan={2} className="pb-1 pr-3 font-semibold">{formatMoney(basePay + tipShare)}</td>
                                <td></td>
                              </tr>
                            )}
                            {isMinApplied && (
                              <tr className="text-sm">
                                <td colSpan={3} className="pb-1 pr-3 text-right text-blue-400">Min Wage Top-up</td>
                                <td colSpan={2} className="pb-1 pr-3 font-semibold text-blue-400">{formatMoney(minPay - basePay - tipShare)}</td>
                                <td></td>
                              </tr>
                            )}
                            <tr className="text-sm">
                              <td colSpan={3} className="pb-2 pr-3 text-right text-muted-foreground">Gross Pay</td>
                              <td colSpan={2} className="pb-2 pr-3 font-bold text-lg">{formatMoney(grossPay)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="mt-3 no-print">
                        <textarea
                          className="w-full text-sm bg-secondary/50 rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none border-0 focus:outline-none focus:ring-1 focus:ring-primary"
                          rows={2}
                          placeholder="Note for pay stub..."
                          value={payrollNotes[staffId] ?? ''}
                          onChange={(ev) => setPayrollNotes(prev => ({ ...prev, [staffId]: ev.target.value }))}
                          onBlur={() => handleSaveNote(staffId, payrollNotes[staffId] ?? '')}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        {finalizedMap[staffId] ? (
                          <span className="text-xs text-emerald-500">
                            Finalized {new Date(finalizedMap[staffId]).toLocaleDateString('en-US', { timeZone: useSessionStore.getState().timezone || 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        ) : <span />}
                        <Button
                          variant={finalizedMap[staffId] ? 'outline' : 'default'}
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            const topUp = isMinApplied ? minPay - basePay - tipShare : 0;
                            handleFinalize(staffId, totalPayHours, basePay, tipShare, topUp, grossPay);
                          }}
                        >
                          {finalizedMap[staffId] ? 'Re-finalize' : 'Finalize'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Print button */}
              <div className="flex justify-end no-print">
                <Button variant="outline" size="sm" onClick={() => handlePrint()}>
                  <Printer size={16} className="mr-1" /> Print Pay Stubs
                </Button>
              </div>
            </>
          )}

          {/* ── Print-only pay stub layout ── */}
          <div className="hidden print:block" id="pay-stub-print">
            <style>{`
              @media print {
                /* Hide everything outside pay stub */
                body * { visibility: hidden; }
                #pay-stub-print, #pay-stub-print * { visibility: visible; }
                #pay-stub-print {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  display: block !important;
                }
                /* Reset background/margins for clean print */
                body, html { margin: 0; padding: 0; background: white; }
                .no-print { display: none !important; }
              }
            `}</style>
            {Object.entries(entriesByStaff)
              .filter(([staffId]) => !printStaffId || staffId === printStaffId)
              .map(([staffId, { name, wage, minWage, entries: staffEntries }]) => {
              const totalPayHours = staffEntries.reduce((sum, e) => {
                if (e.pay_hours != null) return sum + e.pay_hours;
                return sum + roundToHalf(calcWorkedHours(e.clock_in, e.clock_out));
              }, 0);
              const basePay = Math.round(totalPayHours * wage);
              const tipShare = tipShareMap[staffId] ?? 0;
              const minPay = minWage > 0 ? Math.round(totalPayHours * minWage) : 0;
              const isMinApplied = minWage > 0 && minPay > basePay + tipShare;
              const grossPay = isMinApplied ? minPay : basePay + tipShare;

              return (
                <div key={staffId} className="mb-8 break-after-page">
                  <h2 className="text-lg font-bold border-b-2 border-black pb-1 mb-2">{restaurantName} — Pay Stub</h2>
                  <div className="flex justify-between text-sm mb-3">
                    <div>
                      <p><strong>Employee:</strong> {name}</p>
                      <p><strong>Rate:</strong> {formatMoney(wage)}/hr</p>
                      {minWage > 0 && <p><strong>Min Pay:</strong> {formatMoney(minWage)}/hr</p>}
                    </div>
                    <div className="text-right">
                      <p><strong>Period:</strong> {period.label}</p>
                      <p><strong>Date:</strong> {new Date().toLocaleDateString('en-US', { timeZone: useSessionStore.getState().timezone || 'America/Los_Angeles' })}</p>
                    </div>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-black">
                        <th className="text-left py-1">Date</th>
                        <th className="text-left py-1">In</th>
                        <th className="text-left py-1">Out</th>
                        <th className="text-right py-1">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffEntries
                        .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
                        .filter((e) => !(e.clock_out && e.clock_out === e.clock_in && e.pay_hours === 0))
                        .map((e) => {
                          const payH = e.pay_hours ?? roundToHalf(calcWorkedHours(e.clock_in, e.clock_out));
                          return (
                            <tr key={e.id} className="border-b border-gray-300">
                              <td className="py-0.5">{formatDate(e.clock_in)}</td>
                              <td className="py-0.5">{formatTime(e.clock_in)}</td>
                              <td className="py-0.5">{e.clock_out ? formatTime(e.clock_out) : '—'}</td>
                              <td className="py-0.5 text-right">{payH.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black font-bold">
                        <td colSpan={3} className="py-1">Total Hours</td>
                        <td className="py-1 text-right">{totalPayHours.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-0.5">Base Pay</td>
                        <td className="py-0.5 text-right">{formatMoney(basePay)}</td>
                      </tr>
                      {tipShare > 0 && (
                        <tr>
                          <td colSpan={3} className="py-0.5">Tips</td>
                          <td className="py-0.5 text-right">{formatMoney(tipShare)}</td>
                        </tr>
                      )}
                      {tipShare > 0 && (
                        <tr>
                          <td colSpan={3} className="py-0.5">Base + Tips</td>
                          <td className="py-0.5 text-right">{formatMoney(basePay + tipShare)}</td>
                        </tr>
                      )}
                      {isMinApplied && (
                        <tr>
                          <td colSpan={3} className="py-0.5">Min Wage Top-up</td>
                          <td className="py-0.5 text-right">{formatMoney(minPay - basePay - tipShare)}</td>
                        </tr>
                      )}
                      <tr className="font-bold text-base">
                        <td colSpan={3} className="py-1">Gross Pay</td>
                        <td className="py-1 text-right">{formatMoney(grossPay)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {payrollNotes[staffId] && (
                    <div className="mt-3 text-sm border-t border-gray-300 pt-2">
                      <p><strong>Note:</strong> {payrollNotes[staffId]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════ Add/Edit Staff Dialog ═══════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-name">Name *</Label>
              <Input id="staff-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input id="staff-phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="555-0123" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="john@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-hire">Hire Date</Label>
                <Input id="staff-hire" type="date" value={formHireDate} onChange={(e) => setFormHireDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-wage">Hourly Wage ($)</Label>
                <Input id="staff-wage" type="number" step="0.25" min="0" value={formWage} onChange={(e) => setFormWage(e.target.value)} placeholder="15.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-tip">Tip %</Label>
              <Input id="staff-tip" type="number" min="0" max="100" value={formTipPercent} onChange={(e) => setFormTipPercent(e.target.value)} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-min-wage">Min Hourly ($)</Label>
                <Input id="staff-min-wage" type="number" step="0.25" min="0" value={formMinWage} onChange={(e) => setFormMinWage(e.target.value)} placeholder="0" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Tip %: distribution weight (0 = no tips). Min Hourly: guaranteed minimum pay per hour.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-pin">Clock PIN * (4+ digits)</Label>
              <Input id="staff-pin" value={formPin} onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))} placeholder="1234" maxLength={8} />
              <p className="text-xs text-muted-foreground">Used for clock in/out. Must be unique per restaurant.</p>
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive staff cannot clock in</p>
              </div>
              <button
                type="button"
                onClick={() => setFormActive(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${formActive ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveStaff} disabled={formSaving}>
              {formSaving ? 'Saving...' : editingStaff ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════ Edit Time Entry Dialog ═══════════════════════ */}
      <Dialog open={editEntryOpen} onOpenChange={setEditEntryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-date">Date</Label>
              <Input id="edit-date" type="date" value={editEntryDate} onChange={(e) => setEditEntryDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-in">Clock In</Label>
                <Input id="edit-in" type="time" value={editEntryClockIn} onChange={(e) => setEditEntryClockIn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-out">Clock Out</Label>
                <Input id="edit-out" type="time" value={editEntryClockOut} onChange={(e) => setEditEntryClockOut(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-pay">Pay Hours (leave blank for auto)</Label>
              <Input id="edit-pay" type="number" step="0.5" min="0" value={editEntryPayHours} onChange={(e) => setEditEntryPayHours(e.target.value)} placeholder="Auto" className="w-28" />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setEditEntryOpen(false); handleDeleteEntry(editEntryId); }}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveEditEntry} disabled={editEntrySaving}>
                {editEntrySaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════ Manual Time Entry Dialog ═══════════════════════ */}
      <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Time Entry — {manualStaffName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manual-date">Date</Label>
              <Input id="manual-date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-in">Clock In</Label>
                <Input id="manual-in" type="time" value={manualClockIn} onChange={(e) => setManualClockIn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-out">Clock Out</Label>
                <Input id="manual-out" type="time" value={manualClockOut} onChange={(e) => setManualClockOut(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveManualEntry} disabled={manualSaving}>
              {manualSaving ? 'Saving...' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
