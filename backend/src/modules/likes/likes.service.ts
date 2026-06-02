import { prisma } from '../../lib/prisma';
import { getViewablePost } from '../posts/posts.service';

/**
 * Like a post. Idempotent (upsert) — liking again is a no-op success.
 * Gated by visibility: liking a post you cannot see returns 404 (existence hidden).
 */
export async function likePost(userId: string, postId: string) {
  await getViewablePost(postId, userId);

  await prisma.like.upsert({
    where: { userId_postId: { userId, postId } },
    create: { userId, postId },
    update: {},
  });

  const likesCount = await prisma.like.count({ where: { postId } });
  return { liked: true, likesCount };
}

/**
 * Unlike a post. Idempotent — unliking something you don't like still returns 200.
 * Not visibility-gated: retracting your own like must always be allowed
 * (e.g. the post turned private after you liked it).
 */
export async function unlikePost(userId: string, postId: string) {
  await prisma.like.deleteMany({ where: { userId, postId } });
  const likesCount = await prisma.like.count({ where: { postId } });
  return { liked: false, likesCount };
}
