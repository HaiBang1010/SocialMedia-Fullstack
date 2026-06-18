import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';

// Suggested accounts to follow (GET /users/suggested). ONE shared query (limit 10) — RightRail
// slices the first 5, EmptyFeedSuggestions shows all. 5-min stale, no refetch-on-focus (the list
// only needs to change when you follow someone, which invalidates it explicitly).
export function useSuggestedUsers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.suggestedUsers(),
    queryFn: () => usersApi.getSuggested(10),
    select: (res) => res.users,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: isAuthenticated,
  });
}
