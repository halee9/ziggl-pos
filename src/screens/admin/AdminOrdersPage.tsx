import { useAdminStore } from '../../stores/adminStore';
import OrdersScreen from '../OrdersScreen';

export default function AdminOrdersPage() {
  const restaurantCode = useAdminStore((s) => s.restaurantCode);

  return <OrdersScreen restaurantCode={restaurantCode} allowDelete />;
}
