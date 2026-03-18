/**
 * pickupAt이 now보다 thresholdMin분 이상 미래이면 scheduled 주문으로 판별.
 * isScheduled 플래그 대신 pickupAt 시간 기준으로 판단하여,
 * Square 외부 주문(DoorDash 등)도 정확하게 scheduled 처리.
 */
export function isScheduledOrder(
  order: { pickupAt?: string },
  now: number,
  thresholdMin: number,
): boolean {
  if (!order.pickupAt) return false;
  const pickupTime = new Date(order.pickupAt).getTime();
  if (isNaN(pickupTime)) return false;
  return (pickupTime - now) / 60_000 > thresholdMin;
}
