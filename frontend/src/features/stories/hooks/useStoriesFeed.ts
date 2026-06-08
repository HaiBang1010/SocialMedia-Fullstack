import { useQuery } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Active stories of followed users, grouped by author (GET /stories/feed).
// Single fetch (not infinite — the following set is small). `select` unwraps to
// the items array; the cache keeps the raw { items } so storyCache can patch it.
export function useStoriesFeed() {
  return useQuery({
    queryKey: queryKeys.storiesFeed(),
    queryFn: storiesApi.feed,
    select: (res) => res.items,
  });
}
