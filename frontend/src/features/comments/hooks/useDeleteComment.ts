import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { notifyError } from '@/lib/toast';
import {
  patchPostInCaches,
  restorePostCaches,
  snapshotPostCaches,
  type PostCacheSnapshot,
} from '@/lib/postCache';
import {
  bumpRepliesCount,
  removeReply,
  removeRootComment,
  restoreCommentCaches,
  snapshotCommentCaches,
  type CommentCacheSnapshot,
} from '@/lib/commentCache';

interface DeleteCommentVars {
  commentId: string;
  postId: string;
  parentId: string | null; // null = root comment; otherwise the root id (this is a reply)
  repliesCount: number; // for a root, how many replies cascade-delete with it
}

interface DeleteCommentContext {
  commentSnapshot: CommentCacheSnapshot;
  postSnapshot: PostCacheSnapshot;
}

// Delete a comment with an optimistic remove. post.commentsCount counts replies too
// (backend _count.comments has no parentId filter), so:
//   - reply → remove from replies(parentId), root.repliesCount -1, post.commentsCount -1
//   - root  → remove from comments(postId), post.commentsCount -(1 + repliesCount) (cascade);
//             drop the now-orphaned replies(commentId) cache on success.
export function useDeleteComment() {
  const qc = useQueryClient();

  return useMutation<void, Error, DeleteCommentVars, DeleteCommentContext>({
    mutationFn: ({ commentId }) => commentsApi.remove(commentId),

    onMutate: async ({ commentId, postId, parentId, repliesCount }) => {
      const repliesId = parentId ?? commentId; // reply: parent's cache; root: its own replies cache
      await qc.cancelQueries({ queryKey: queryKeys.replies(repliesId) });
      await qc.cancelQueries({ queryKey: queryKeys.comments(postId) });

      const commentSnapshot = snapshotCommentCaches(qc, postId, repliesId);
      const postSnapshot = snapshotPostCaches(qc, postId);

      if (parentId) {
        removeReply(qc, parentId, commentId);
        bumpRepliesCount(qc, postId, parentId, -1);
        patchPostInCaches(qc, postId, (p) => ({
          ...p,
          commentsCount: Math.max(0, p.commentsCount - 1),
        }));
      } else {
        removeRootComment(qc, postId, commentId);
        patchPostInCaches(qc, postId, (p) => ({
          ...p,
          commentsCount: Math.max(0, p.commentsCount - (1 + repliesCount)),
        }));
      }

      return { commentSnapshot, postSnapshot };
    },

    onError: (err, _vars, ctx) => {
      if (ctx) {
        restoreCommentCaches(qc, ctx.commentSnapshot);
        restorePostCaches(qc, ctx.postSnapshot);
      }
      notifyError(err, "Couldn't delete comment");
    },

    onSuccess: (_data, { commentId, parentId }) => {
      // A deleted root cascades its replies on the server; drop the stale cache.
      if (!parentId) qc.removeQueries({ queryKey: queryKeys.replies(commentId) });
    },
  });
}
