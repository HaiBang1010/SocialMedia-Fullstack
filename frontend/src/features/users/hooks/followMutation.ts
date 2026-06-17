import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { notifyError } from '@/lib/toast';
import type { FollowResponse, ProfileResponse } from '@/types/api';

type FollowDirection = 'follow' | 'unfollow';

interface FollowContext {
  prev: ProfileResponse | undefined;
}

// Shared engine for useFollow / useUnfollow. Optimistically toggles isFollowing +
// followersCount on the cached profile (queryKeys.user(username)), rolls back on
// error, then invalidates onSettled to reconcile the AUTHORITATIVE count — the
// follow response only carries { following }, not the new followersCount.
// Scope: only the profile cache. The feed and posts' isFollowingAuthor flag are
// left to refetch on their own (out of scope for the profile follow button).
export function useFollowMutation(username: string, direction: FollowDirection) {
  const qc = useQueryClient();
  const following = direction === 'follow';

  return useMutation<FollowResponse, Error, void, FollowContext>({
    mutationFn: () =>
      following ? followsApi.follow(username) : followsApi.unfollow(username),

    onMutate: async () => {
      const key = queryKeys.user(username);
      // Cancel in-flight refetches so they can't clobber the optimistic state.
      await qc.cancelQueries({ queryKey: key });

      const prev = qc.getQueryData<ProfileResponse>(key);

      // Idempotent toggle — guards both StrictMode double-invoke and double-click.
      qc.setQueryData<ProfileResponse>(key, (data) => {
        if (!data) return data;
        const u = data.user;
        if (following) {
          return u.isFollowing
            ? data
            : {
                user: {
                  ...u,
                  isFollowing: true,
                  followersCount: u.followersCount + 1,
                },
              };
        }
        return u.isFollowing
          ? {
              user: {
                ...u,
                isFollowing: false,
                followersCount: Math.max(0, u.followersCount - 1),
              },
            }
          : data;
      });

      return { prev };
    },

    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(queryKeys.user(username), ctx.prev);
      notifyError(err, following ? "Couldn't follow user" : "Couldn't unfollow user");
    },

    onSuccess: (data) => {
      // Server is the source of truth for the relationship.
      qc.setQueryData<ProfileResponse>(queryKeys.user(username), (cur) =>
        cur ? { user: { ...cur.user, isFollowing: data.following } } : cur,
      );
    },

    onSettled: () => {
      // Reconcile followersCount (and everything else) with the server.
      qc.invalidateQueries({ queryKey: queryKeys.user(username) });
    },
  });
}
