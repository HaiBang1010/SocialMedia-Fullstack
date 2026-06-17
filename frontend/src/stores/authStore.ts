import { create } from 'zustand';
import { queryClient } from '@/lib/queryClient';
import type { User } from '@/types/api';

// Phase Polish — auth state is MEMORY-ONLY (no localStorage / no persist middleware). The refresh
// token lives in an httpOnly cookie (unreadable by JS → mitigates XSS token theft); the access
// token is held here in memory and restored on reload by useAuthBootstrap (POST /auth/refresh →
// GET /auth/me). `authStatus` gates the route guards while that boot-refresh is in flight, so the
// app shows a spinner instead of bouncing to /login before the session is known.
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  // Kept (derived from authStatus) because useSocketConnection gates the socket on it.
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  // /auth/refresh returns only a new access token (the refresh cookie is unchanged — non-rotating).
  setAccessToken: (accessToken: string) => void;
  setAuthStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  authStatus: 'loading', // until useAuthBootstrap resolves the session

  login: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, authStatus: 'authenticated' }),

  logout: () => {
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      authStatus: 'unauthenticated',
    });
    // Drop all cached server state on logout so the next user can't briefly see the previous
    // user's feed/posts (stale cache + privacy leak).
    queryClient.clear();
  },

  updateUser: (user) => set({ user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setAuthStatus: (authStatus) => set({ authStatus }),
}));
