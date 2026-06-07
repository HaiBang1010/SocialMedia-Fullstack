import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { commentsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  patchPostInCaches,
  restorePostCaches,
  snapshotPostCaches,
  type PostCacheSnapshot,
} from '@/lib/postCache';
import {
  appendReply,
  bumpRepliesCount,
  replaceReply,
  restoreCommentCaches,
  snapshotCommentCaches,
  type CommentCacheSnapshot,
} from '@/lib/commentCache';
import { useAuthStore } from '@/stores/authStore';
import type { Comment, CommentListResponse } from '@/types/api';

interface CreateCommentVars {
  content: string;
  parentId?: string; // when set, this is a reply (parentId = root comment id)
}

interface CreateCommentContext {
  commentSnapshot: CommentCacheSnapshot;
  postSnapshot: PostCacheSnapshot;
  tempId: string | null; // optimistic id (null when not authenticated)
}

// Prepend a comment to the FIRST page of the root list (newest-first → newest on top,
// so the user sees their comment immediately). No-op when the list isn't loaded yet.
function prependCommentFirstPage(
  data: InfiniteData<CommentListResponse> | undefined,
  comment: Comment,
): InfiniteData<CommentListResponse> | undefined {
  if (!data || data.pages.length === 0) return data;
  const pages = data.pages.map((pg, i) =>
    i === 0 ? { ...pg, comments: [comment, ...pg.comments] } : pg,
  );
  return { ...data, pages };
}

// Post a comment OR reply with an optimistic insert + count bumps. On success we
// invalidate the affected list (root comments, or the parent's replies) to pull the
// real id/order from the server — safer than reconciling a temp id inside a cursor list.
//   - root comment → prepend to comments(postId), post.commentsCount +1
//   - reply        → append to replies(parentId), root.repliesCount +1, post.commentsCount +1
//     (post.commentsCount counts replies too, since the backend _count.comments has no parentId filter)
export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  return useMutation<Comment, Error, CreateCommentVars, CreateCommentContext>({
    mutationFn: ({ content, parentId }) =>
      commentsApi.create(postId, { content, parentId }),

    onMutate: async ({ content, parentId }) => {
      const listKey = parentId
        ? queryKeys.replies(parentId)
        : queryKeys.comments(postId);
      await qc.cancelQueries({ queryKey: listKey });

      const commentSnapshot = snapshotCommentCaches(qc, postId, parentId);
      const postSnapshot = snapshotPostCaches(qc, postId);

      let tempId: string | null = null;
      if (me) {
        tempId = `temp-${crypto.randomUUID()}`;
        const optimistic: Comment = {
          id: tempId,
          postId,
          authorId: me.id,
          parentId: parentId ?? null,
          content,
          createdAt: new Date().toISOString(),
          author: me,
          repliesCount: 0,
        };

        if (parentId) {
          appendReply(qc, parentId, optimistic);
          bumpRepliesCount(qc, postId, parentId, +1);
        } else {
          qc.setQueryData<InfiniteData<CommentListResponse>>(
            queryKeys.comments(postId),
            (data) => prependCommentFirstPage(data, optimistic),
          );
        }
        patchPostInCaches(qc, postId, (p) => ({
          ...p,
          commentsCount: p.commentsCount + 1,
        }));
      }

      return { commentSnapshot, postSnapshot, tempId };
    },

    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      restoreCommentCaches(qc, ctx.commentSnapshot);
      restorePostCaches(qc, ctx.postSnapshot);
    },

    onSuccess: (data, { parentId }, ctx) => {
      if (parentId) {
        // Replies are chronological (newest LAST), so invalidating would refetch the
        // oldest page and drop the just-posted reply on longer threads. Swap the temp
        // reply in place; only fall back to a refetch if it wasn't in the cache.
        const swapped = ctx?.tempId ? replaceReply(qc, parentId, ctx.tempId, data) : false;
        if (!swapped) qc.invalidateQueries({ queryKey: queryKeys.replies(parentId) });
      } else {
        // Root list is newest-first, so the new comment lands on the refetched page 0.
        qc.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      }
    },
  });
}
