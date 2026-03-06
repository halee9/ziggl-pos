# KDS Display: show_on_kds + server_alert 두 필드 추가

## 배경

주방 디스플레이에 표시할 필요 없는 항목(예: White rice 기본 옵션, Seaweed 미리 준비)과
출력 티켓에 서버가 재확인해야 할 항목(예: 빠뜨리기 쉬운 추가 옵션)을 구분하는 기능 추가.

---

## 신규 필드 (영어 이름)

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `show_on_kds` | boolean | `true` | KDS 주방화면 출력 여부. false면 화면에서 숨김 |
| `server_alert` | boolean | `false` | 주문 티켓 하단에 큰 글씨로 "확인 요망" 표시 |

두 필드 모두 **`menu_display`와 `modifier_display` 테이블 양쪽**에 추가.

---

## 구현 범위

### Step 1: Supabase SQL (수동 실행)

```sql
ALTER TABLE menu_display
  ADD COLUMN IF NOT EXISTS show_on_kds BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS server_alert BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE modifier_display
  ADD COLUMN IF NOT EXISTS show_on_kds BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS server_alert BOOLEAN NOT NULL DEFAULT false;
```

---

### Step 2: 타입 추가

**`restaurant-kds/src/types.ts`** — `MenuDisplayItem`, `ModifierDisplayItem` 양쪽에 추가:
```typescript
show_on_kds?: boolean;
server_alert?: boolean;
```

**`restaurant-server/src/services/supabaseClient.ts`** — 동일하게 양쪽 인터페이스에 추가.

> ⚠️ `upsertMenuDisplay`는 이미 `...m` spread를 사용하므로 새 필드 자동 포함됨 — 백엔드 로직 변경 불필요.

---

### Step 3: utils.ts — 반환 타입 확장

**`restaurant-kds/src/utils.ts`**

`getItemDisplay()` 반환 타입에 `showOnKds`, `serverAlert` 추가:
```typescript
export function getItemDisplay(
  itemName: string,
  menuDisplay: MenuDisplayItem[]
): { label: string; bgColor: string; textColor: string; showOnKds: boolean; serverAlert: boolean } {
  const config = menuDisplay.find(
    (m) => m.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || itemName,
    bgColor:     config?.bg_color     || '#F3F4F6',
    textColor:   config?.text_color   || '#111827',
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
  };
}
```

`getModifierDisplay()` 반환 타입을 `string` → 객체로 변경 (기존 호출부도 함께 업데이트):
```typescript
export function getModifierDisplay(
  modifierName: string,
  modifierDisplay: ModifierDisplayItem[]
): { label: string; showOnKds: boolean; serverAlert: boolean } {
  const config = modifierDisplay.find(
    (m) => m.modifier_name.toLowerCase().trim() === modifierName.toLowerCase().trim()
  );
  return {
    label:       config?.abbreviation || modifierName,
    showOnKds:   config?.show_on_kds  ?? true,
    serverAlert: config?.server_alert ?? false,
  };
}
```

---

### Step 4: OrderCard.tsx

**`restaurant-kds/src/components/OrderCard.tsx`**

- `show_on_kds === false` 항목은 렌더링 skip (`return null`)
- modifier도 `showOnKds === false`이면 표시 안 함
- `serverAlert === true` 항목에 `⚠` 붉은 인디케이터 표시

```tsx
{order.lineItems.map((item, idx) => {
  const display = getItemDisplay(item.name, menuItems);
  if (!display.showOnKds) return null;               // ← KDS 숨김
  return (
    <div key={idx}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-bold text-sm min-w-[1.5rem]">{item.quantity}×</span>
        <span
          className="px-2 py-0.5 rounded font-bold text-sm"
          style={{ backgroundColor: display.bgColor, color: display.textColor }}
        >
          {display.label}
          {display.serverAlert && <span className="ml-1 text-red-500 text-xs">⚠</span>}
        </span>
        ...
      </div>
      {/* 모디파이어 — show_on_kds 필터 적용 */}
      {item.modifiers?.length > 0 && (
        <div className="ml-6 mt-0.5 flex flex-wrap gap-1">
          {item.modifiers.map((mod, mIdx) => {
            const modDisplay = getModifierDisplay(mod, modifierDisplay);
            if (!modDisplay.showOnKds) return null;
            return (
              <span key={mIdx} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {modDisplay.label}
                {modDisplay.serverAlert && <span className="ml-0.5 text-red-400">⚠</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
})}
```

---

### Step 5: OrderList.tsx

**`restaurant-kds/src/components/OrderList.tsx`**

- 동일하게 `show_on_kds === false` 항목/모디파이어 skip
- `serverAlert` 항목에 `⚠` 추가 (칩 오른쪽)
- `modAbbrs` 로직: `getModifierDisplay()` 반환값 변경에 맞게 `.label` 사용

```tsx
const modChips = (item.modifiers ?? [])
  .map(m => getModifierDisplay(m, modifierDisplay))
  .filter(d => d.showOnKds);

// 칩 렌더링
{modChips.length > 0 && (
  <span className="text-xs text-muted-foreground">
    [{modChips.map(d => d.serverAlert ? `⚠${d.label}` : d.label).join(' ')}]
  </span>
)}
```

---

### Step 6: PrintTicket.tsx

**`restaurant-kds/src/components/PrintTicket.tsx`**

- `useKDSStore()`에서 `menuDisplayConfig` 접근
- `server_alert = true`인 항목/모디파이어 수집
- 티켓 하단 TOTAL 위에 "⚠ CONFIRM:" 섹션 추가 (대문자 굵은 글씨)

```tsx
import { useKDSStore } from '../stores/kdsStore';
import { getItemDisplay, getModifierDisplay } from '../utils';

export default function PrintTicket({ order }: Props) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;

  // server_alert 항목 수집
  const alertLines: string[] = [];
  order.lineItems.forEach(item => {
    const d = getItemDisplay(item.name, menuItems);
    if (d.serverAlert) alertLines.push(`${item.quantity}x ${d.label || item.name}`);
    (item.modifiers ?? []).forEach(mod => {
      const md = getModifierDisplay(mod, modifierDisplay);
      if (md.serverAlert) alertLines.push(`  + ${md.label || mod}`);
    });
  });

  return (
    <div className="print-only ...">
      ...기존 내용...

      {alertLines.length > 0 && (
        <>
          <hr className="border-black my-2 border-dashed" />
          <div className="font-bold text-base">⚠ CONFIRM:</div>
          {alertLines.map((line, i) => (
            <div key={i} className="font-black text-lg">{line}</div>
          ))}
        </>
      )}

      <hr className="border-black my-3" />
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{formatMoney(order.totalMoney)}</span>
      </div>
    </div>
  );
}
```

---

### Step 7: MenuDisplayEditor.tsx

**`restaurant-kds/src/components/MenuDisplayEditor.tsx`**

#### updateMenuItem 시그니처 변경
```typescript
const updateMenuItem = (itemName: string, field: keyof MenuDisplayItem, value: string | boolean) => {
```

#### updateModifier 함수 일반화
```typescript
// 기존: abbreviation 전용
const updateModifier = (modifierName: string, value: string) => { ... }

// 변경 후: 임의 필드 지원
const updateModifierField = (modifierName: string, field: keyof ModifierDisplayItem, value: string | boolean) => {
  setModifierConfig((prev) => ({
    ...prev,
    [modifierName]: {
      ...prev[modifierName],
      restaurant_code: restaurantCode,
      modifier_name: modifierName,
      [field]: value,
    },
  }));
};
```
> 기존 abbreviation input의 `onChange` → `updateModifierField(mod.name, 'abbreviation', e.target.value)` 로 교체.

#### 메뉴 항목 행에 토글 추가
기존 Abbr. 입력 행 아래에:
```tsx
<div className="flex items-center gap-3 flex-wrap pl-1 mt-1">
  <label className="flex items-center gap-1.5 cursor-pointer">
    <input
      type="checkbox"
      checked={cfg.show_on_kds ?? true}
      onChange={e => updateMenuItem(item.name, 'show_on_kds', e.target.checked)}
      className="w-3.5 h-3.5"
    />
    <span className="text-xs text-muted-foreground">Show on KDS</span>
  </label>
  <label className="flex items-center gap-1.5 cursor-pointer">
    <input
      type="checkbox"
      checked={cfg.server_alert ?? false}
      onChange={e => updateMenuItem(item.name, 'server_alert', e.target.checked)}
      className="w-3.5 h-3.5 accent-red-500"
    />
    <span className="text-xs text-red-400 font-medium">Server Alert ⚠</span>
  </label>
</div>
```

#### 모디파이어 행에 동일 토글 추가
```tsx
<label className="flex items-center gap-1 cursor-pointer">
  <input type="checkbox" checked={cfg.show_on_kds ?? true}
    onChange={e => updateModifierField(mod.name, 'show_on_kds', e.target.checked)} />
  <span className="text-xs">KDS</span>
</label>
<label className="flex items-center gap-1 cursor-pointer">
  <input type="checkbox" checked={cfg.server_alert ?? false}
    onChange={e => updateModifierField(mod.name, 'server_alert', e.target.checked)}
    className="accent-red-500" />
  <span className="text-xs text-red-400">⚠</span>
</label>
```

---

## 수정 파일 전체 목록

| 위치 | 파일 | 변경 |
|---|---|---|
| Supabase | SQL 수동 실행 | 4개 컬럼 추가 |
| restaurant-kds | `src/types.ts` | 2개 필드 × 2 인터페이스 |
| restaurant-server | `src/services/supabaseClient.ts` | 2개 필드 × 2 인터페이스 |
| restaurant-kds | `src/utils.ts` | 두 함수 반환 타입 확장 |
| restaurant-kds | `src/components/OrderCard.tsx` | show_on_kds 필터 + serverAlert 표시 |
| restaurant-kds | `src/components/OrderList.tsx` | 동일 |
| restaurant-kds | `src/components/PrintTicket.tsx` | server_alert 섹션 추가 |
| restaurant-kds | `src/components/MenuDisplayEditor.tsx` | 토글 UI + 함수 확장 |

> `restaurant-server/src/routes/menuDisplay.ts` — 변경 불필요 (기존 upsert 로직이 새 필드 자동 포함)

---

## 배포

1. restaurant-server: `railway up --detach` (types 변경이지만 영향 없음 — 생략 가능)
2. restaurant-kds: Vercel 자동 배포 (Git push)

---

## 검증

1. Supabase Table Editor에서 두 테이블에 `show_on_kds`, `server_alert` 컬럼 확인
2. Admin → Menu Display → "White rice" modifier의 Show on KDS 체크 해제 → 저장
3. KDS 화면에서 White rice가 포함된 주문 확인 → White rice 모디파이어 미표시 확인
4. "Extra Sauce" modifier에 Server Alert 체크 → 저장
5. 해당 주문 프린트 → 티켓 하단 "⚠ CONFIRM: Extra Sauce" 섹션 확인
6. 설정 없는 항목은 기존과 동일하게 show_on_kds=true, server_alert=false로 동작 확인
