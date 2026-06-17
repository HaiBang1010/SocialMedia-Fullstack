import { toast } from 'sonner';
import { getApiError } from '@/lib/apiError';

// Phase Polish 1 (A) — app-wide toast helpers (sonner). Mounted once in App.tsx.
//
// Rule: toast only on USER-INITIATED actions (mutations / explicit interactions).
// NEVER wire these into a query's onError or a refetchInterval — a flaky backend
// would spam the user on every background poll.

/**
 * Toast an error. Prefers the backend's user-facing message (the API returns
 * English error messages by project convention), falling back to `fallback` for
 * network / non-API failures where no structured body exists.
 */
export function notifyError(err: unknown, fallback: string): void {
  toast.error(getApiError(err)?.message ?? fallback);
}

/**
 * Toast a success — for actions with no immediate visual confirmation (e.g. a
 * new post that never appears in your own feed). Skip it when the result is
 * already visible on screen (a sent message, an applied edit).
 */
export function notifySuccess(message: string): void {
  toast.success(message);
}
