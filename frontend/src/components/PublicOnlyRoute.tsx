import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Spinner from '@/components/common/Spinner';

// Phase Polish — mirror of ProtectedRoute. While the boot-refresh is in flight ('loading'), show a
// spinner so an authenticated reload doesn't flash the login page before redirecting home.
export default function PublicOnlyRoute() {
  const authStatus = useAuthStore((s) => s.authStatus);

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return authStatus === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />;
}
