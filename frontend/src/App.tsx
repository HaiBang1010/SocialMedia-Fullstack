import {
  Routes,
  Route,
  Navigate,
  useLocation,
  type Location,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicOnlyRoute from '@/components/PublicOnlyRoute';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import FeedPage from '@/pages/FeedPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import UserProfilePage from '@/pages/UserProfilePage';
import PostDetailPage from '@/pages/PostDetailPage';
import ArchivePage from '@/pages/ArchivePage';
import MessagesPage from '@/pages/MessagesPage';
import NotificationsPage from '@/pages/NotificationsPage';
import SearchPage from '@/pages/SearchPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PostDetailModal from '@/components/post/PostDetailModal';

// `/profile` is a stable alias for the current user's own profile URL. It lives
// under ProtectedRoute, so a user always exists here.
function ProfileRedirect() {
  const username = useAuthStore((s) => s.user?.username);
  return <Navigate to={username ? `/users/${username}` : '/login'} replace />;
}

export default function App() {
  // Keep <html> `.dark` class in sync with the theme store.
  useThemeEffect();
  // Phase Polish — restore the session from the httpOnly refresh cookie on load (gates route guards).
  useAuthBootstrap();
  // Toast theme follows the app theme (light/dark) so toasts match dark mode.
  const theme = useThemeStore((s) => s.theme);

  // When a post is opened from the feed on desktop, we stash the feed location
  // in `state.background` so the main <Routes> keeps rendering the feed while
  // the post shows as an overlay. Mobile/direct loads have no background, so
  // `/posts/:id` resolves to the full PostDetailPage instead.
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/profile" element={<ProfileRedirect />} />
            <Route path="/me/stories/archive" element={<ArchivePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/users/:username" element={<UserProfilePage />} />
            <Route path="/posts/:id" element={<PostDetailPage />} />
          </Route>
        </Route>

        {/* Catch-all 404 — standalone (no app shell), any path that matched nothing above. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Overlay modal — only mounts when navigated with a background location. */}
      {background && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/posts/:id" element={<PostDetailModal />} />
          </Route>
        </Routes>
      )}

      {/* App-wide toasts (Phase Polish 1A). Mounted here — OUTSIDE both AuthLayout
          and AppLayout — so login/register network errors surface too. theme tracks
          the theme store to match dark mode. */}
      <Toaster position="top-right" theme={theme} richColors closeButton />
    </>
  );
}
