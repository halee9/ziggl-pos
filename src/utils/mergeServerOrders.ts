import type { KDSOrder, OrderStatus } from '../types';

const STATUS_RANK: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  OPEN: 1,
  IN_PROGRESS: 2,
  READY: 3,
  COMPLETED: 4,
  CANCELED: 99,
};

/**
 * 서버 fetchActiveOrders 응답을 로컬 orders와 forward-only로 병합한다.
 *
 * 서버 응답이 in-flight인 동안 socket emit으로 로컬이 더 진전된 status에
 * 도달했을 수 있다. 그 stale 응답이 setOrders로 그대로 들어오면 status가
 * backward로 덮인다. 이 함수는:
 *  - 로컬에 같은 id가 있고 로컬 status rank가 더 높으면 로컬을 보존
 *  - 서버 status가 CANCELED면 무조건 서버 우선 (취소는 어디서든 적용)
 *  - 그 외엔 서버 응답 사용 (cardBrand 등 새 필드 반영을 위해)
 *  - 서버에 없는 로컬 주문(localOnly)은 그대로 추가
 */
export function mergeServerOrders(
  serverOrders: KDSOrder[],
  localOrders: KDSOrder[],
): KDSOrder[] {
  const localById = new Map(localOrders.map((o) => [o.id, o]));
  const serverIdSet = new Set(serverOrders.map((o) => o.id));

  const merged = serverOrders.map((srv) => {
    const local = localById.get(srv.id);
    if (!local) return srv;
    if (srv.status === 'CANCELED') return srv;
    const localRank = STATUS_RANK[local.status] ?? 0;
    const srvRank = STATUS_RANK[srv.status] ?? 0;
    if (localRank > srvRank) return local;
    return srv;
  });

  const localOnly = localOrders.filter((o) => !serverIdSet.has(o.id));
  return [...merged, ...localOnly];
}
