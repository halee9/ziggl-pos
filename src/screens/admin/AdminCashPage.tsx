import { useAdminStore } from '../../stores/adminStore';
import CashManagementScreen from '../CashManagementScreen';

export default function AdminCashPage() {
  const restaurantCode = useAdminStore((s) => s.restaurantCode);

  return <CashManagementScreen restaurantCode={restaurantCode} role="owner" />;
}
