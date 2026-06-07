// Cache surgery for comments + replies. Mirrors lib/postCache.ts but for the two
// comment caches:
//   - queryKeys.comments(postId)   → InfiniteData<CommentListResponse> (root, newest-first)
//   - queryKeys.replies(rootId)    → InfiniteData<CommentListResponse> (replies, chronological)
//
// Both are addressable by an EXACT key (unlike userPosts), so no predicate sweep
// is needed. The mappers return the SAME reference when nothing changed so React
// Query doesn't notify observers unnecessarily.

import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import type { Comment, CommentListResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

type CommentInfinite = InfiniteData<CommentListResponse> | undefined;
type CommentUpdater = (c: Comment) => Comment;

// Apply `updater` to the comment with `id` inside an infinite list, cloning only
// the pages/arrays that change.
function mapCommentInInfinite(
  data: CommentInfinite,
  id: string,
  updater: CommentUpdater,
): CommentInfinite {
  if (!data) return data;
  let touched = false;
  const pages = data.pages.map((page) => {
    let pageTouched = false;
    const comments = page.comments.map((c) => {
      if (c.id !== id) return c;
      pageTouched = true;
      touched = true;
      return updater(c);
    });
    return pageTouched ? { ...page, comments } : page;
  });
  return touched ? { ...data, pages } : data;
}

function removeCommentFromInfinite(data: CommentInfinite, id: string): CommentInfinite {
  if (!data) return data;
  let touched = false;
  const pages = data.pages.map((page) => {
    const comments = page.comments.filter((c) => c.id !== id);
    if (comments.length === page.comments.length) return page;
    touched = true;
    return { ...page, comments };
  });
  return touched ? { ...data, pages } : data;
}

// Bump a root comment's repliesCount (clamped at 0) inside the comments(postId) cache.
export function bumpRepliesCount(
  qc: QueryClient,
  postId: string,
  rootId: string,
  delta: number,
): void {
  qc.setQueryData<InfiniteData<CommentListResponse>>(
    queryKeys.comments(postId),
    (data) =>
      mapCommentInInfinite(data, rootId, (c) => ({
        ...c,
        repliesCount: Math.max(0, c.repliesCount + delta),
      })),
  );
}

// Append an (optimistic) reply to the END of the last page of replies(rootId).
// Replies are chronological, so newest goes last. No-op when the list isn't loaded.
export function appendReply(qc: QueryClient, rootId: string, reply: Comment): void {
  qc.setQueryData<InfiniteData<CommentListResponse>>(
    queryKeys.replies(rootId),
    (data) => {
      if (!data || data.pages.length === 0) return data;
      const last = data.pages.length - 1;
      const pages = data.pages.map((pg, i) =>
        i === last ? { ...pg, comments: [...pg.comments, reply] } : pg,
      );
      return { ...data, pages };
    },
  );
}

// Replace an optimistic (temp-id) reply with the server's real one, in place.
// Returns true if the temp reply was found and swapped. Used instead of invalidating
// the replies list: replies are chronological (newest LAST), so a refetch would reset
// to the oldest page and drop the just-posted reply from view on longer threads.
export function replaceReply(
  qc: QueryClient,
  rootId: string,
  tempId: string,
  real: Comment,
): boolean {
  let replaced = false;
  qc.setQueryData<InfiniteData<CommentListResponse>>(queryKeys.replies(rootId), (data) => {
    if (!data) return data;
    const pages = data.pages.map((page) => {
      let pageTouched = false;
      const comments = page.comments.map((c) => {
        if (c.id !== tempId) return c;
        pageTouched = true;
        replaced = true;
        return real;
      });
      return pageTouched ? { ...page, comments } : page;
    });
    return replaced ? { ...data, pages } : data;
  });
  return replaced;
}

// Remove a reply from the replies(rootId) cache.
export function removeReply(qc: QueryClient, rootId: string, replyId: string): void {
  qc.setQueryData<InfiniteData<CommentListResponse>>(
    queryKeys.replies(rootId),
    (data) => removeCommentFromInfinite(data, replyId),
  );
}

// Remove a root comment from the comments(postId) cache.
export function removeRootComment(qc: QueryClient, postId: string, commentId: string): void {
  qc.setQueryData<InfiniteData<CommentListResponse>>(
    queryKeys.comments(postId),
    (data) => removeCommentFromInfinite(data, commentId),
  );
}

// Snapshot the comments(postId) cache plus an optional replies(repliesId) cache,
// for rollback in onError. The post cache (commentsCount) is snapshotted separately
// via lib/postCache's snapshotPostCaches.
export interface CommentCacheSnapshot {
  commentsKey: QueryKey;
  comments: InfiniteData<CommentListResponse> | undefined;
  repliesKey: QueryKey | null;
  replies: InfiniteData<CommentListResponse> | undefined;
}

export function snapshotCommentCaches(
  qc: QueryClient,
  postId: string,
  repliesId?: string,
): CommentCacheSnapshot {
  return {
    commentsKey: queryKeys.comments(postId),
    comments: qc.getQueryData<InfiniteData<CommentListResponse>>(queryKeys.comments(postId)),
    repliesKey: repliesId ? queryKeys.replies(repliesId) : null,
    replies: repliesId
      ? qc.getQueryData<InfiniteData<CommentListResponse>>(queryKeys.replies(repliesId))
      : undefined,
  };
}

export function restoreCommentCaches(qc: QueryClient, snap: CommentCacheSnapshot): void {
  qc.setQueryData(snap.commentsKey, snap.comments);
  if (snap.repliesKey) qc.setQueryData(snap.repliesKey, snap.replies);
}
