import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  ClipboardCheck, Plus, Settings2, Check, Hash, Trash2,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, GripVertical, History,
} from 'lucide-react';
import { todayStr, formatDateDisplay } from '../utils/timezone';

// dnd-kit
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface TaskTemplate {
  id: string;
  title: string;
  type: 'check' | 'quantity';
  target_quantity: number | null;
  sort_order: number;
  is_active: boolean;
  staff_id: string | null;
}

interface TaskLog {
  id: string;
  staff_id: string;
  staff_name: string;
  completed: boolean;
  quantity: number | null;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

interface DailyTask {
  template: TaskTemplate;
  logs: TaskLog[];
}

interface StaffMember {
  id: string;
  name: string;
}

interface Approval {
  approved_at: string | null;
  approved_by: string | null;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.split(' ')[0];
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

// ─── Sortable Template Item (dnd-kit) ────────────────────────────────────────

function SortableTemplateItem({
  template, staffList, onToggleActive, onDelete, onStaffAssign, onRename,
}: {
  template: TaskTemplate;
  staffList: StaffMember[];
  onToggleActive: (t: TaskTemplate) => void;
  onDelete: (id: string) => void;
  onStaffAssign: (templateId: string, staffId: string | null) => void;
  onRename: (templateId: string, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: template.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(template.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== template.title) {
      onRename(template.id, trimmed);
    } else {
      setEditTitle(template.title);
    }
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="py-2 border-b border-border last:border-0 space-y-1">
      {/* Line 1: drag handle + title */}
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0">
          <GripVertical size={16} />
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="text-sm bg-transparent border-b border-foreground outline-none w-full"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditTitle(template.title); setEditing(false); } }}
            autoFocus
          />
        ) : (
          <span
            className={`text-sm cursor-pointer hover:underline ${template.is_active ? '' : 'text-muted-foreground line-through'}`}
            onClick={() => setEditing(true)}
          >
            {template.title}
          </span>
        )}
      </div>
      {/* Line 2: type badge, staff, active toggle, delete */}
      <div className="flex items-center gap-1 pl-6">
        <Badge variant="outline" className="text-xs shrink-0">{template.type}</Badge>
        <Select
          value={template.staff_id || '_none'}
          onValueChange={(v) => onStaffAssign(template.id, v === '_none' ? null : v)}
        >
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue placeholder="Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">None</SelectItem>
            {staffList.map((s) => (
              <SelectItem key={s.id} value={s.id}>{firstName(s.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => onToggleActive(template)}>
          {template.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(template.id)} className="text-destructive">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── 인라인 Task Card ────────────────────────────────────────────────────────

function InlineTaskCard({
  task, staffList, disabled, onRecord, onHistory,
}: {
  task: DailyTask;
  staffList: StaffMember[];
  disabled: boolean;
  onRecord: (templateId: string, staffId: string, data: { completed?: boolean; quantity?: number }) => void;
  onHistory: (templateId: string) => void;
}) {
  const { template, logs } = task;
  const log = logs[0] ?? null; // 한 task에 최대 1개 로그
  const [selectedStaff, setSelectedStaff] = useState(log?.staff_id || template.staff_id || '');
  const [quantity, setQuantity] = useState('');

  // 기록 완료 여부: check 타입은 completed, quantity 타입은 quantity > 0
  const hasRecord = log != null && (
    (template.type === 'check' && log.completed) ||
    (template.type === 'quantity' && log.quantity != null && log.quantity > 0)
  );

  const handleStaffChange = (v: string) => {
    const newStaff = v === '_none' ? '' : v;
    setSelectedStaff(newStaff);
    // 이미 완료된 기록이 있으면 staff 변경 시 바로 저장
    if (newStaff && hasRecord && !disabled) {
      if (template.type === 'check') {
        onRecord(template.id, newStaff, { completed: log!.completed });
      } else {
        onRecord(template.id, newStaff, { quantity: log!.quantity ?? 0 });
      }
    }
  };

  const handleCheckToggle = () => {
    if (!selectedStaff || disabled) return;
    const newVal = log ? !log.completed : true;
    onRecord(template.id, selectedStaff, { completed: newVal });
  };

  const handleQuantitySubmit = () => {
    if (!selectedStaff || disabled || !quantity) return;
    onRecord(template.id, selectedStaff, { quantity: Number(quantity) || 0 });
    setQuantity('');
  };

  // 카드 스타일: 기록 완료 시 테두리 색상 변경
  const cardClass = hasRecord
    ? 'border-emerald-500/50 bg-emerald-500/5'
    : '';

  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{template.title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onHistory(template.id)} aria-label="History" className="h-7 w-7 p-0">
              <History size={14} />
            </Button>
            <Badge variant="secondary">
              {template.type === 'check' ? (
                <><Check size={12} className="mr-1" />Check</>
              ) : (
                <><Hash size={12} className="mr-1" />Qty{template.target_quantity ? ` / ${template.target_quantity}` : ''}</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Select value={selectedStaff || '_none'} onValueChange={handleStaffChange} disabled={disabled}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue placeholder="Staff..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Select...</SelectItem>
              {staffList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{firstName(s.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {template.type === 'check' ? (
            <Button
              size="sm"
              variant={log?.completed ? 'default' : 'outline'}
              onClick={handleCheckToggle}
              disabled={!selectedStaff || disabled}
              className="h-8"
            >
              <Check size={14} className="mr-1" />
              {log?.completed ? 'Done' : 'Mark Done'}
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={log?.quantity != null ? String(log.quantity) : '0'}
                disabled={!selectedStaff || disabled}
                className="w-20 h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleQuantitySubmit()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleQuantitySubmit}
                disabled={!selectedStaff || disabled || !quantity}
                className="h-8"
              >
                Save
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function TasksScreen() {
  const restaurantCode = useSessionStore((s) => s.restaurantCode);
  const staffName = useSessionStore((s) => s.staffName);
  const role = useSessionStore((s) => s.role);
  const isOwner = role === 'owner';

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [allTemplates, setAllTemplates] = useState<TaskTemplate[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayStr());

  const isApproved = !!approval?.approved_at;
  const isToday = date === todayStr();
  const canGoForward = date < todayStr();

  // Template management sheet
  const [manageOpen, setManageOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'check' | 'quantity'>('check');
  const [newTargetQty, setNewTargetQty] = useState('');
  const [newStaffId, setNewStaffId] = useState('');

  // History sheet
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTemplate, setHistoryTemplate] = useState<TaskTemplate | null>(null);
  const [historyLogs, setHistoryLogs] = useState<Array<{
    id: string; task_date: string; staff_name: string; completed: boolean;
    quantity: number | null; note: string | null; approved: boolean;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const code = restaurantCode?.toLowerCase() || '';

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── 데이터 로드 ──────────────────────────────────────────────────────────

  const fetchDaily = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/tasks/${code}/daily?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.staff) setStaffList(data.staff);
        setApproval(data.approval ?? null);
      }
    } catch (err) {
      console.error('[Tasks] fetchDaily error:', err);
    }
  }, [code, date]);

  const fetchTemplates = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/tasks/${code}/templates`);
      if (res.ok) {
        const data = await res.json();
        setAllTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('[Tasks] fetchTemplates error:', err);
    }
  }, [code]);

  useEffect(() => {
    setLoading(true);
    fetchDaily().finally(() => setLoading(false));
  }, [fetchDaily]);

  // ── 인라인 기록 ──────────────────────────────────────────────────────────

  const handleRecord = async (templateId: string, staffId: string, data: { completed?: boolean; quantity?: number }) => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          date,
          staff_id: staffId,
          completed: data.completed,
          quantity: data.quantity,
          recorded_by: staffName,
        }),
      });
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] record error:', err);
    }
  };

  // ── 히스토리 ────────────────────────────────────────────────────────────

  const openHistory = async (templateId: string) => {
    const tmpl = tasks.find((t) => t.template.id === templateId)?.template ?? null;
    setHistoryTemplate(tmpl);
    setHistoryLogs([]);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/tasks/${code}/history/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('[Tasks] history error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── 승인 ────────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/daily/${date}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: staffName }),
      });
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] approve error:', err);
    }
  };

  const handleUnapprove = async () => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/daily/${date}/unapprove`, {
        method: 'POST',
      });
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] unapprove error:', err);
    }
  };

  // ── 템플릿 관리 ──────────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!newTitle.trim()) return;
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          target_quantity: newType === 'quantity' ? Number(newTargetQty) || null : null,
          staff_id: newStaffId || null,
        }),
      });
      setNewTitle('');
      setNewType('check');
      setNewTargetQty('');
      setNewStaffId('');
      fetchTemplates();
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] create template error:', err);
    }
  };

  const handleToggleActive = async (template: TaskTemplate) => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active }),
      });
      fetchTemplates();
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] toggle error:', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] delete error:', err);
    }
  };

  const handleStaffAssign = async (templateId: string, staffId: string | null) => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      });
      fetchTemplates();
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] staff assign error:', err);
    }
  };

  const handleRename = async (templateId: string, title: string) => {
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      fetchTemplates();
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] rename error:', err);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allTemplates.findIndex((t) => t.id === active.id);
    const newIndex = allTemplates.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(allTemplates, oldIndex, newIndex);
    setAllTemplates(reordered);

    const order = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    try {
      await fetch(`${SERVER_URL}/api/tasks/${code}/templates/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      fetchDaily();
    } catch (err) {
      console.error('[Tasks] reorder error:', err);
    }
  };

  const openManage = () => {
    fetchTemplates();
    setManageOpen(true);
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck size={24} className="text-foreground" />
          <h1 className="text-lg font-bold">Daily Tasks</h1>
        </div>
        <Button variant="outline" size="sm" onClick={openManage}>
          <Settings2 size={16} className="mr-1" />
          Manage Templates
        </Button>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Previous day">
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-medium text-foreground min-w-[220px] text-center">
          {formatDateDisplay(date)}
          {isToday && <span className="text-xs text-muted-foreground ml-2">(Today)</span>}
        </span>
        <Button variant="outline" size="sm" onClick={() => setDate((d) => shiftDate(d, 1))} disabled={!canGoForward} aria-label="Next day">
          <ChevronRight size={16} />
        </Button>
        {isApproved && (
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-1">
            ✓ Approved
          </Badge>
        )}
      </div>

      {/* 태스크 카드 리스트 */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks configured. Use "Manage Templates" to add tasks.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <InlineTaskCard
              key={task.template.id}
              task={task}
              staffList={staffList}
              disabled={isApproved}
              onRecord={handleRecord}
              onHistory={openHistory}
            />
          ))}
        </div>
      )}

      {/* Owner Approve/Unapprove */}
      {isOwner && (
        <div className="pt-2">
          {isApproved ? (
            <Button variant="outline" className="w-full text-amber-400 border-amber-500/30" onClick={handleUnapprove}>
              Unapprove
            </Button>
          ) : (
            <Button variant="outline" className="w-full text-emerald-400 border-emerald-500/30" onClick={handleApprove}>
              ✓ Approve
            </Button>
          )}
        </div>
      )}

      {/* Template Management Sheet */}
      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-auto p-6">
          <SheetHeader>
            <SheetTitle>Manage Task Templates</SheetTitle>
          </SheetHeader>

          {/* 새 템플릿 추가 */}
          <div className="mt-4 space-y-3 border-b border-border pb-4">
            <h3 className="text-sm font-semibold">Add New Template</h3>
            <div className="space-y-2">
              <Input placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <Select value={newType} onValueChange={(v) => setNewType(v as 'check' | 'quantity')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="quantity">Quantity</SelectItem>
                  </SelectContent>
                </Select>
                {newType === 'quantity' && (
                  <Input type="number" placeholder="Target qty" value={newTargetQty} onChange={(e) => setNewTargetQty(e.target.value)} className="w-28" />
                )}
                <Select value={newStaffId || '_none'} onValueChange={(v) => setNewStaffId(v === '_none' ? '' : v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No staff</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{firstName(s.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleCreateTemplate} disabled={!newTitle.trim()}>
                <Plus size={14} className="mr-1" />Add
              </Button>
            </div>
          </div>

          {/* 기존 템플릿 리스트 (드래그 순서 변경) */}
          <div className="mt-4">
            {allTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No templates yet</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={allTemplates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {allTemplates.map((t) => (
                    <SortableTemplateItem
                      key={t.id}
                      template={t}
                      staffList={staffList}
                      onToggleActive={handleToggleActive}
                      onDelete={handleDeleteTemplate}
                      onStaffAssign={handleStaffAssign}
                      onRename={handleRename}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-auto p-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History size={18} />
              {historyTemplate?.title ?? 'Task'} History
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No history records</p>
            ) : (
              <div className="space-y-2">
                {historyLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{formatDateDisplay(log.task_date)}</div>
                      <div className="text-xs text-muted-foreground">
                        {firstName(log.staff_name)}
                        {log.note && <span> — {log.note}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {historyTemplate?.type === 'check' ? (
                        <Badge variant={log.completed ? 'default' : 'destructive'} className="text-xs">
                          {log.completed ? 'Done' : 'Not done'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {log.quantity ?? 0}{historyTemplate?.target_quantity ? ` / ${historyTemplate.target_quantity}` : ''}
                        </Badge>
                      )}
                      {log.approved && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-400">✓</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
