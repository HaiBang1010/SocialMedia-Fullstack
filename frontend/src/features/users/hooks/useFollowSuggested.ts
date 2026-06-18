import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { notifyError } from '@/lib/toast';
import type { FollowResponse, SuggestedUsersResponse } from '@/types/api';

interface FollowSuggestedContext {
  prev?: SuggestedUsersResponse;
}

// Follow a suggested user (Q4 — refresh after follow). Optimistically removes the card from the
// suggested list (it's now followed, so it no longer belongs), then invalidates onSettled so the
// list refetches a fresh 10 (backfilling the freed slot). Rolls back + toasts on error.
export function useFollowSuggested() {
  const qc = useQueryClient();

  return useMutation<FollowResponse, Error, string, FollowSuggestedContext>({
    mutationFn: (username) => followsApi.follow(username),

    onMutate: async (username) => {
      const key = queryKeys.suggestedUsers();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SuggestedUsersResponse>(key);
      qc.setQueryData<SuggestedUsersResponse>(key, (d) =>
        d ? { users: d.users.filter((u) => u.username !== username) } : d,
      );
      return { prev };
    },

    onError: (err, _username, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.suggestedUsers(), ctx.prev);
      notifyError(err, "Couldn't follow user");
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suggestedUsers() });
    },
  });
}
