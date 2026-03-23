import { Outlet } from 'react-router-dom';
import AdminHeader from './AdminHeader';
import AdminBottomNav from './AdminBottomNav';

export default function AdminLayout() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminHeader />
      <main className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
      <AdminBottomNav />
    </div>
  );
}
