import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MenuDisplayItem, ModifierDisplayItem } from '../types';

interface SquareMenuItem {
  id: string;
  name: string;
  categoryId?: string;
  modifierLists?: { id: string; name: string; modifiers: { id: string; name: string }[] }[];
}

interface Props {
  restaurantCode: string;
  pin: string;
}

const COLOR_PRESETS = [
  { bg: '#FFFFFF', text: '#111827', label: 'White' },
  { bg: '#FDE68A', text: '#92400E', label: 'Gold' },
  { bg: '#BBF7D0', text: '#14532D', label: 'Green' },
  { bg: '#BFDBFE', text: '#1E3A5F', label: 'Blue' },
  { bg: '#FED7AA', text: '#7C2D12', label: 'Orange' },
  { bg: '#E9D5FF', text: '#4C1D95', label: 'Purple' },
  { bg: '#FECACA', text: '#7F1D1D', label: 'Red' },
  { bg: '#1E293B', text: '#F1F5F9', label: 'Dark' },
];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function MenuDisplayEditor({ restaurantCode, pin }: Props) {
  const [squareItems, setSquareItems] = useState<SquareMenuItem[]>([]);
  const [menuConfig, setMenuConfig] = useState<Record<string, MenuDisplayItem>>({});
  const [modifierConfig, setModifierConfig] = useState<Record<string, ModifierDisplayItem>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [menuRes, configRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/menu`),
          fetch(`${SERVER_URL}/api/menu-display/${restaurantCode.toLowerCase()}`),
        ]);

        if (menuRes.ok) {
          const { items } = await menuRes.json();
          setSquareItems(items ?? []);
        }

        if (configRes.ok) {
          const { menuItems, modifiers } = await configRes.json();
          const menuMap: Record<string, MenuDisplayItem> = {};
          (menuItems ?? []).forEach((m: MenuDisplayItem) => { menuMap[m.item_name] = m; });
          setMenuConfig(menuMap);

          const modMap: Record<string, ModifierDisplayItem> = {};
          (modifiers ?? []).forEach((m: ModifierDisplayItem) => { modMap[m.modifier_name] = m; });
          setModifierConfig(modMap);
        }
      } catch (err) {
        setErrorMsg('Failed to load menu data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [restaurantCode]);

  const updateMenuItem = (itemName: string, field: keyof MenuDisplayItem, value: string) => {
    setMenuConfig((prev) => ({
      ...prev,
      [itemName]: { ...prev[itemName], restaurant_code: restaurantCode, item_name: itemName, [field]: value },
    }));
  };

  const updateModifier = (modifierName: string, value: string) => {
    setModifierConfig((prev) => ({
      ...prev,
      [modifierName]: { ...prev[modifierName], restaurant_code: restaurantCode, modifier_name: modifierName, abbreviation: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const menuItems = Object.values(menuConfig).filter((m) => m.abbreviation || m.bg_color || m.text_color);
      const modifiers = Object.values(modifierConfig).filter((m) => m.abbreviation);

      const res = await fetch(`${SERVER_URL}/api/menu-display/${restaurantCode.toLowerCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, menuItems, modifiers }),
      });

      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to save');
        return;
      }
      setSuccessMsg('Menu display settings saved!');
    } catch {
      setErrorMsg('Cannot connect to server.');
    } finally {
      setSaving(false);
    }
  };

  // Square menu의 모든 modifier를 중복 없이 수집
  const allModifiers = Array.from(
    new Map(
      squareItems.flatMap((item) =>
        (item.modifierLists ?? []).flatMap((ml) =>
          ml.modifiers.map((m) => [m.name, m])
        )
      )
    ).values()
  );

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading menu...</div>;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* 메뉴 항목 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Menu Items</CardTitle>
          <p className="text-xs text-muted-foreground">약어와 배경색/글씨색을 설정하면 KDS에 적용됩니다. 비워두면 원래 이름과 기본 색상이 사용됩니다.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {squareItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No menu items found from Square Catalog.</p>
          ) : (
            squareItems.map((item) => {
              const cfg = menuConfig[item.name] ?? {};
              const previewBg   = cfg.bg_color   || '#F3F4F6';
              const previewText = cfg.text_color  || '#111827';
              const previewLabel = cfg.abbreviation || item.name;
              return (
                <div key={item.id} className="flex flex-col gap-2 border border-border rounded-md p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* 미리보기 */}
                    <span
                      className="px-2 py-1 rounded font-bold text-sm min-w-[3rem] text-center shrink-0"
                      style={{ backgroundColor: previewBg, color: previewText }}
                    >
                      {previewLabel.slice(0, 8)}
                    </span>
                    {/* Square 원래 이름 */}
                    <span className="text-sm text-muted-foreground flex-1 min-w-[8rem]">{item.name}</span>
                    {/* 약어 입력 */}
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs w-16 shrink-0">Abbr.</Label>
                      <Input
                        value={cfg.abbreviation ?? ''}
                        onChange={(e) => updateMenuItem(item.name, 'abbreviation', e.target.value)}
                        maxLength={8}
                        placeholder={item.name.slice(0, 6)}
                        className="h-7 w-24 text-xs"
                      />
                    </div>
                  </div>
                  {/* 색상 프리셋 */}
                  <div className="flex items-center gap-1.5 flex-wrap pl-1">
                    <span className="text-xs text-muted-foreground mr-1">Color:</span>
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.bg}
                        type="button"
                        title={preset.label}
                        onClick={() => {
                          updateMenuItem(item.name, 'bg_color', preset.bg);
                          updateMenuItem(item.name, 'text_color', preset.text);
                        }}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          cfg.bg_color === preset.bg ? 'border-primary scale-110' : 'border-border'
                        }`}
                        style={{ backgroundColor: preset.bg }}
                      />
                    ))}
                    {/* 직접 입력 */}
                    <Input
                      value={cfg.bg_color ?? ''}
                      onChange={(e) => updateMenuItem(item.name, 'bg_color', e.target.value)}
                      placeholder="#FFFFFF"
                      className="h-6 w-20 text-xs"
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 모디파이어 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider">Modifiers / Options</CardTitle>
          <p className="text-xs text-muted-foreground">옵션 약어만 설정합니다. KDS에서 모디파이어를 짧게 표시합니다.</p>
        </CardHeader>
        <CardContent>
          {allModifiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modifiers found from Square Catalog.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allModifiers.map((mod) => {
                const cfg = modifierConfig[mod.name] ?? {};
                return (
                  <div key={mod.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground flex-1 truncate">{mod.name}</span>
                    <Input
                      value={cfg.abbreviation ?? ''}
                      onChange={(e) => updateModifier(mod.name, e.target.value)}
                      maxLength={6}
                      placeholder={mod.name.slice(0, 5)}
                      className="h-7 w-20 text-xs shrink-0"
                    />
                    {cfg.abbreviation && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                        {cfg.abbreviation}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 저장 */}
      {errorMsg && <p className="text-destructive text-sm text-center">{errorMsg}</p>}
      {successMsg && <p className="text-green-400 text-sm text-center">{successMsg}</p>}
      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? 'Saving...' : 'Save Menu Display Settings'}
      </Button>
    </div>
  );
}
