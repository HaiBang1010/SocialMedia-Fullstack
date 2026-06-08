import { useQuery } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// One user's active stories (GET /users/:username/stories). `enabled` lets the
// viewer fetch only when open. `select` unwraps to the stories array; the cache
// keeps the raw { stories } so storyCache can patch it.
export function useUserStories(username: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userStories(username ?? ''),
    queryFn: () => storiesApi.listByUsername(username!),
    select: (res) => res.stories,
    enabled: enabled && Boolean(username),
  });
}
