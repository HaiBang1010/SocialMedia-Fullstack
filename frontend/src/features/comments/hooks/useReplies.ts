import { useInfiniteQuery } from '@tanstack/react-query';
import { commentsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite replies list (GET /comments/:id/replies), chronological (oldest-first).
// Lazy: only fetched once the caller mounts/enables it (user expanded "View replies").
export function useReplies(commentId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.replies(commentId),
    queryFn: ({ pageParam }) => commentsApi.listReplies(commentId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && Boolean(commentId),
  });
}
