import type { KDSOrder } from '../types';
import { formatMoney, formatTime, getItemDisplay, getModifierDisplay } from '../utils';
import { useKDSStore } from '../stores/kdsStore';

interface Props {
  order: KDSOrder;
}

// 프린트 전용 컴포넌트 - window.print() 호출 시 이 내용만 출력됨
export default function PrintTicket({ order }: Props) {
  const { menuDisplayConfig } = useKDSStore();
  const { menuItems, modifiers: modifierDisplay } = menuDisplayConfig;

  // server_alert 항목/모디파이어 수집
  const alertLines: string[] = [];
  order.lineItems.forEach((item) => {
    const d = getItemDisplay(item.name, menuItems);
    if (d.serverAlert) alertLines.push(`${item.quantity}x ${d.label}`);
    (item.modifiers ?? []).forEach((mod) => {
      const md = getModifierDisplay(mod, modifierDisplay);
      if (md.serverAlert) alertLines.push(`  + ${md.label}`);
    });
  });

  return (
    <div className="print-only hidden p-4 text-black bg-white font-mono text-sm">
      <div className="text-center font-bold text-lg mb-2">ORDER #{order.displayId}</div>
      <div className="text-center mb-1">{order.source}</div>
      <div className="text-center text-xs mb-3">{formatTime(order.createdAt)}</div>
      <hr className="border-black mb-3" />
      {order.lineItems.map((item, idx) => (
        <div key={idx} className="mb-2">
          <div className="flex justify-between font-bold">
            <span>{item.quantity}x {item.name}</span>
          </div>
          {item.variationName && (
            <div className="ml-4 text-xs">• {item.variationName}</div>
          )}
          {item.modifiers?.map((mod, i) => (
            <div key={i} className="ml-4 text-xs">+ {mod}</div>
          ))}
        </div>
      ))}
      {order.note && (
        <>
          <hr className="border-black my-2" />
          <div className="font-bold">NOTE: {order.note}</div>
        </>
      )}
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
