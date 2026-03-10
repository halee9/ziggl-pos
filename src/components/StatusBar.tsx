import { LayoutGrid, List, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { KDSTab, ViewMode } from '../stores/sessionStore';

interface Props {
  connected: boolean;
  restaurantName: string;
  activeTab: KDSTab;
  onTabChange: (tab: KDSTab) => void;
  counts: { active: number; scheduled: number; ready: number; done: number };
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onLogout: () => void;
  onSettings: () => void;
}

export default function StatusBar({
  connected, restaurantName,
  activeTab, onTabChange,
  counts, viewMode, onViewModeChange,
  onLogout, onSettings,
}: Props) {
  const tabCls = (tab: KDSTab) =>
    `flex items-center gap-1.5 px-3 py-2 rounded text-sm font-bold transition-colors ${
      activeTab === tab
        ? 'bg-secondary text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="no-print flex items-center justify-between px-4 py-2 bg-card border-b border-border gap-2">
      {/* 연결 상태 */}
      <div className="flex items-center gap-2 min-w-24 flex-shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        <span className={`text-sm font-semibold truncate ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? (restaurantName || 'Live') : 'Offline'}
        </span>
      </div>

      {/* 4탭 */}
      <div className="flex items-center gap-0.5">
        {/* Active */}
        <button onClick={() => onTabChange('active')} className={tabCls('active')}>
          Active
          {counts.active > 0 && (
            <Badge variant={activeTab === 'active' ? 'default' : 'secondary'} className="h-5 px-1.5 text-xs">
              {counts.active}
            </Badge>
          )}
        </button>

        {/* Scheduled */}
        <button onClick={() => onTabChange('scheduled')} className={tabCls('scheduled')}>
          <span className="hidden sm:inline">Scheduled</span>
          <span className="sm:hidden">Sched</span>
          {counts.scheduled > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs border-purple-500 text-purple-400">
              {counts.scheduled}
            </Badge>
          )}
        </button>

        {/* Ready */}
        <button onClick={() => onTabChange('ready')} className={tabCls('ready')}>
          Ready
          {counts.ready > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs border-green-500 text-green-400">
              {counts.ready}
            </Badge>
          )}
        </button>

        {/* Done */}
        <button onClick={() => onTabChange('done')} className={tabCls('done')}>
          Done
          {counts.done > 0 && (
            <Badge variant={activeTab === 'done' ? 'default' : 'secondary'} className="h-5 px-1.5 text-xs">
              {counts.done}
            </Badge>
          )}
        </button>
      </div>

      {/* 뷰 토글 + 날짜 + 설정 + 로그아웃 */}
      <div className="flex items-center gap-2 min-w-24 justify-end flex-shrink-0">
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="h-8 px-2.5 rounded-none border-0"
            title="List view"
          >
            <List className="h-5 w-5" />
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('card')}
            className="h-8 px-2.5 rounded-none border-0"
            title="Card view"
          >
            <LayoutGrid className="h-5 w-5" />
          </Button>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-xs text-muted-foreground hidden sm:block">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <Separator orientation="vertical" className="h-5 hidden sm:block" />
        <Button variant="ghost" size="sm" onClick={onSettings} className="h-8 px-2 text-muted-foreground" title="KDS Settings">
          <Settings className="h-5 w-5" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button variant="ghost" size="sm" onClick={onLogout} className="h-8 px-2 text-muted-foreground" title="Logout">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
