import { useMutation, useQueryClient } from '@tanstack/react-query';
import { likesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  patchPostInCaches,
  restorePostCaches,
  snapshotPostCaches,
  userPostsPredicate,
  type PostCacheSnapshot,
} from '@/lib/postCache';
import type { LikeResponse } from '@/types/api';

type LikeDirection = 'like' | 'unlike';

interface LikeContext {
  snapshot: PostCacheSnapshot;
}

// Shared engine for useLikePost / useUnlikePost. Optimistically toggles the post
// across every cache, rolls back on error, and reconciles to the server's
// authoritative count on success. Deliberately does NOT invalidate the feed
// (that would refetch + reshuffle the list and cost the user their scroll).
export function useLikeMutation(postId: string, direction: LikeDirection) {
  const qc = useQueryClient();
  const liking = direction === 'like';

  return useMutation<LikeResponse, Error, void, LikeContext>({
    mutationFn: () => (liking ? likesApi.like(postId) : likesApi.unlike(postId)),

    onMutate: async () => {
      // Cancel in-flight refetches so they can't clobber the optimistic state.
      await qc.cancelQueries({ queryKey: queryKeys.post(postId) });
      await qc.cancelQueries({ queryKey: queryKeys.feed() });
      await qc.cancelQueries({ predicate: userPostsPredicate });

      const snapshot = snapshotPostCaches(qc, postId);

      // Idempotent toggle — guards both StrictMode double-invoke and double-click.
      patchPostInCaches(qc, postId, (p) => {
        if (liking) {
          return p.isLikedByMe
            ? p
            : { ...p, isLikedByMe: true, likesCount: p.likesCount + 1 };
        }
        return p.isLikedByMe
          ? { ...p, isLikedByMe: false, likesCount: Math.max(0, p.likesCount - 1) }
          : p;
      });

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx) restorePostCaches(qc, ctx.snapshot);
    },

    onSuccess: (data) => {
      // Server is the source of truth for the count (handles concurrent likes).
      patchPostInCaches(qc, postId, (p) => ({
        ...p,
        isLikedByMe: data.liked,
        likesCount: data.likesCount,
      }));
    },
  });
}
