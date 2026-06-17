import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Spinner from '@/components/common/Spinner';

// Phase Polish — gate on authStatus, not a sync boolean. While the boot-refresh is in flight
// ('loading'), render a spinner instead of bouncing to /login (the session isn't known yet).
export default function ProtectedRoute() {
  const authStatus = useAuthStore((s) => s.authStatus);

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return authStatus === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
}
