import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { markAuthorFollowedInCaches } from '@/lib/postCache';
import { notifyError } from '@/lib/toast';
import type { FollowResponse } from '@/types/api';

interface FollowAuthorVars {
  username: string;
  authorId: string;
}

// Follow a post's author inline (the stranger Follow button on PostCard, mixed feed). On success,
// flip isFollowingAuthor=true on every cached post by that author (feed + profile grids) so the
// button hides WITHOUT refetching the feed (keeps scroll position). Reconciles the profile +
// suggested caches. Patch on success (not optimistic) → no rollback; a failed follow leaves the
// button (correct — still not followed) + a toast.
export function useFollowAuthor() {
  const qc = useQueryClient();

  return useMutation<FollowResponse, Error, FollowAuthorVars>({
    mutationFn: ({ username }) => followsApi.follow(username),
    onSuccess: (_data, { username, authorId }) => {
      markAuthorFollowedInCaches(qc, authorId);
      qc.invalidateQueries({ queryKey: queryKeys.user(username) });
      qc.invalidateQueries({ queryKey: queryKeys.suggestedUsers() });
    },
    onError: (err) => notifyError(err, "Couldn't follow user"),
  });
}
