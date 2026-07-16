import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatWidget from './ChatWidget';
import NotificationBell from './NotificationBell';
import SupportButton from './SupportButton';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <Outlet />
      </main>
      <NotificationBell />
      <SupportButton />
      <ChatWidget />
    </div>
  );
}
