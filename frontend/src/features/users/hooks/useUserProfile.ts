import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { getStatus } from '@/lib/apiError';

// Public profile (GET /users/:username) → ProfileUser (counts + isFollowing).
// The cache stores the raw `{ user }` envelope (so the follow mutation can patch
// it); `select` unwraps it so consumers get the ProfileUser directly.
export function useUserProfile(username: string) {
  return useQuery({
    queryKey: queryKeys.user(username),
    queryFn: () => usersApi.getByUsername(username),
    select: (res) => res.user,
    enabled: Boolean(username),
    // A 404 (no such user) shouldn't retry — surface the not-found instantly.
    retry: (count, err) => getStatus(err) !== 404 && count < 1,
  });
}
