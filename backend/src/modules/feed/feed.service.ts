import { PostVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { postInclude, serializePost } from '../posts/posts.service';
import type { PaginationInput } from '../posts/posts.schema';

// Feed = posts của những user mình follow, trong N ngày gần đây.
const FEED_DAYS = 14;

/**
 * Personalized feed: posts from users the viewer follows, last 14 days,
 * PUBLIC + FOLLOWERS only (PRIVATE bị loại). Order chronological (createdAt desc, id desc);
 * shuffle do frontend lo (xem ARCHITECTURE §6). Cursor pagination.
 */
export async function getFeed(viewerId: string, pagination: PaginationInput) {
  const rows = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const followingIds = rows.map((r) => r.followingId);

  // Chưa follow ai → feed rỗng (frontend gợi ý "Suggested for you").
  if (followingIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const cutoff = new Date(Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000);
  const { cursor, limit } = pagination;

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: followingIds },
      createdAt: { gte: cutoff },
      visibility: { in: ['PUBLIC', 'FOLLOWERS'] as PostVisibility[] },
    },
    include: postInclude(viewerId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // lấy dư 1 để biết còn trang sau
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1]!.id : null;

  // isFollowingAuthor LUÔN true — đã filter authorId ∈ những người mình follow.
  return {
    posts: items.map((p) => serializePost(p, { isFollowingAuthor: true })),
    nextCursor,
  };
}
