import { useEffect, useRef } from 'react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

// Phase Polish — restore the session on app load. The refresh token lives in an httpOnly cookie,
// so on a fresh page there's no in-memory access token: POST /auth/refresh (cookie auto-sent) →
// GET /auth/me. Success → authenticated; ANY failure (no/expired cookie, backend down) →
// unauthenticated. Route guards render a spinner while authStatus is 'loading'.
//
// Runs ONCE — a ref guards against React StrictMode's dev double-invoke firing two boot refreshes.
export function useAuthBootstrap() {
  const didBoot = useRef(false);

  useEffect(() => {
    if (didBoot.current) return;
    didBoot.current = true;

    const { setAccessToken, login, setAuthStatus } = useAuthStore.getState();

    void (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        setAccessToken(accessToken); // so the GET /auth/me request carries the bearer token
        const { user } = await authApi.me();
        login(user, accessToken); // sets user + isAuthenticated + authStatus 'authenticated'
      } catch {
        setAuthStatus('unauthenticated');
      }
    })();
  }, []);
}
