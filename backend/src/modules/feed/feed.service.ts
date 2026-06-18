import { PostVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { postInclude, serializePost } from '../posts/posts.service';
import type { PaginationInput } from '../posts/posts.schema';

// Recency window (both streams). 90 ngày — 14 làm feed trông trống với account ít hoạt động.
const FEED_DAYS = 90;
// Bound the in-memory stranger ranking pool (and thus stranger-phase pagination depth). Beyond this
// the feed stops surfacing strangers — acceptable at this app's scale.
const STRANGER_POOL_CAP = 100;

type EnrichedPost = Awaited<ReturnType<typeof fetchFollowedPosts>>['items'][number];

/**
 * Single MIXED feed: followed users' posts first, then PUBLIC posts from strangers filling the
 * remainder. Stranger ranking = friends-of-friends → popular (likes+comments) → recent, done
 * in-memory over a capped pool (reuses postInclude + serializePost — no raw SQL).
 *
 * Cursor is PHASE-PREFIXED (opaque to the client): undefined / "f:<postId>" = followed phase,
 * "s:<offset>" = stranger phase. The followed stream is keyset-paginated; once it's exhausted on a
 * page, strangers fill the rest and the cursor switches to the stranger offset.
 */
export async function getFeed(viewerId: string, pagination: PaginationInput) {
  const { cursor, limit } = pagination;
  const cutoff = new Date(Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000);

  const followingIds = (
    await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } })
  ).map((r) => r.followingId);

  // ── Stranger phase ("s:<offset>") — followed stream already exhausted ──────────────────
  if (cursor?.startsWith('s:')) {
    const offset = Math.max(0, parseInt(cursor.slice(2), 10) || 0);
    const { posts, nextOffset } = await rankedStrangers(viewerId, followingIds, cutoff, offset, limit);
    return {
      posts: posts.map((p) => serializePost(p, { isFollowingAuthor: false })),
      nextCursor: nextOffset !== null ? `s:${nextOffset}` : null,
    };
  }

  // ── Followed phase (undefined or "f:<id>"; tolerate a legacy bare-id cursor) ────────────
  const followedCursorId = cursor?.startsWith('f:') ? cursor.slice(2) : cursor;
  const followed = await fetchFollowedPosts(viewerId, followingIds, cutoff, followedCursorId, limit);

  // Page full of followed posts → stay in the followed phase.
  if (followed.hasMore) {
    return {
      posts: followed.items.map((p) => serializePost(p, { isFollowingAuthor: true })),
      nextCursor: `f:${followed.items[followed.items.length - 1]!.id}`,
    };
  }

  // Followed exhausted → fill the remainder with ranked strangers (offset 0).
  const remaining = limit - followed.items.length;
  const fill =
    remaining > 0
      ? await rankedStrangers(viewerId, followingIds, cutoff, 0, remaining)
      : { posts: [] as EnrichedPost[], nextOffset: null as number | null };

  return {
    posts: [
      ...followed.items.map((p) => serializePost(p, { isFollowingAuthor: true })),
      ...fill.posts.map((p) => serializePost(p, { isFollowingAuthor: false })),
    ],
    nextCursor: fill.nextOffset !== null ? `s:${fill.nextOffset}` : null,
  };
}

/** Keyset page of posts from followed authors (PUBLIC + FOLLOWERS, within the window). `in: []`
 * (no follows) returns nothing — the caller then fills with strangers. */
async function fetchFollowedPosts(
  viewerId: string,
  followingIds: string[],
  cutoff: Date,
  cursorId: string | undefined,
  limit: number,
) {
  const rows = await prisma.post.findMany({
    where: {
      authorId: { in: followingIds },
      createdAt: { gte: cutoff },
      visibility: { in: ['PUBLIC', 'FOLLOWERS'] as PostVisibility[] },
    },
    include: postInclude(viewerId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

/** Ranked PUBLIC stranger posts (not me, not anyone I follow), within the window. Ranking is
 * friends-of-friends → popular (likes+comments) → recent, computed in-memory over a capped pool,
 * then sliced by `offset`/`count`. Returns the slice + the next offset (null when the pool is spent). */
async function rankedStrangers(
  viewerId: string,
  followingIds: string[],
  cutoff: Date,
  offset: number,
  count: number,
) {
  const pool = await prisma.post.findMany({
    where: {
      authorId: { notIn: [viewerId, ...followingIds] },
      visibility: 'PUBLIC',
      createdAt: { gte: cutoff },
    },
    include: postInclude(viewerId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: STRANGER_POOL_CAP,
  });

  // Friends-of-friends: accounts followed by the people I follow (minus self + who I already follow).
  let fofSet = new Set<string>();
  if (followingIds.length > 0) {
    const fof = await prisma.follow.findMany({
      where: { followerId: { in: followingIds } },
      select: { followingId: true },
    });
    fofSet = new Set(fof.map((f) => f.followingId));
    fofSet.delete(viewerId);
    for (const id of followingIds) fofSet.delete(id);
  }

  const ranked = pool
    .map((p) => ({
      post: p,
      fof: fofSet.has(p.authorId) ? 1 : 0,
      engagement: p._count.likes + p._count.comments,
    }))
    .sort(
      (a, b) =>
        b.fof - a.fof ||
        b.engagement - a.engagement ||
        b.post.createdAt.getTime() - a.post.createdAt.getTime(),
    );

  const slice = ranked.slice(offset, offset + count).map((r) => r.post);
  const nextOffset = offset + slice.length < ranked.length ? offset + slice.length : null;
  return { posts: slice, nextOffset };
}
