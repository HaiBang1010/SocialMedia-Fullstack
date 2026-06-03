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
import { useAuthStore } from '@/stores/authStore';
import type { Comment, CommentListResponse } from '@/types/api';

interface CreateCommentContext {
  prevComments: InfiniteData<CommentListResponse> | undefined;
  postSnapshot: PostCacheSnapshot;
}

// Prepend a comment to the FIRST page (list is newest-first → newest at the top,
// so the user sees their comment immediately without scrolling).
// No-op when the list isn't loaded yet — onSuccess invalidate will populate it.
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

// Post a comment with an optimistic prepend + comment-count bump. On success we
// invalidate the comment list to pull the real id/order from the server (much
// safer than hand-reconciling a temp id inside a cursor-paginated list); the
// count stays at its optimistic +1 since the server incremented it too.
export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  return useMutation<Comment, Error, string, CreateCommentContext>({
    mutationFn: (content: string) => commentsApi.create(postId, { content }),

    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: queryKeys.comments(postId) });

      const key = queryKeys.comments(postId);
      const prevComments =
        qc.getQueryData<InfiniteData<CommentListResponse>>(key);
      const postSnapshot = snapshotPostCaches(qc, postId);

      if (me) {
        const optimistic: Comment = {
          id: `temp-${crypto.randomUUID()}`,
          postId,
          authorId: me.id,
          parentId: null,
          content,
          createdAt: new Date().toISOString(),
          author: me,
        };
        qc.setQueryData<InfiniteData<CommentListResponse>>(key, (data) =>
          prependCommentFirstPage(data, optimistic),
        );
        patchPostInCaches(qc, postId, (p) => ({
          ...p,
          commentsCount: p.commentsCount + 1,
        }));
      }

      return { prevComments, postSnapshot };
    },

    onError: (_err, _content, ctx) => {
      if (!ctx) return;
      qc.setQueryData(queryKeys.comments(postId), ctx.prevComments);
      restorePostCaches(qc, ctx.postSnapshot);
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comments(postId) });
    },
  });
}
