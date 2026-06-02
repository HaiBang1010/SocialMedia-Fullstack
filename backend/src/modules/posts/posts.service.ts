import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { s3Client } from '../../lib/s3';
import { env } from '../../config/env';
import { publicUserSelect } from '../users/users.service';
import { isFollowing } from '../follows/follows.service';
import type { CreatePostInput, UpdatePostInput, PaginationInput } from './posts.schema';

// include dùng chung cho mọi response trả 1 post
const postInclude = {
  author: { select: publicUserSelect },
  media: { orderBy: { order: 'asc' as const } },
} as const;

/**
 * Fetch a post enforcing READ visibility, or throw 404 (existence hidden — never 403 on read).
 * - PUBLIC: anyone
 * - FOLLOWERS: the owner, or a viewer who follows the author
 * - PRIVATE: owner only
 * Shared gate for getPostById (Phiên 2), likes, and comments.
 * Returns a minimal projection; callers that need the full post re-fetch with `postInclude`.
 */
export async function getViewablePost(postId: string, viewerId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, visibility: true },
  });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }

  const isOwner = viewerId === post.authorId;
  if (isOwner || post.visibility === 'PUBLIC') {
    return post;
  }
  if (post.visibility === 'FOLLOWERS' && viewerId && (await isFollowing(viewerId, post.authorId))) {
    return post;
  }

  // PRIVATE for a non-owner, or FOLLOWERS for a non-follower -> hide existence.
  throw new AppError(404, 'PostNotFound', 'Post not found');
}

/**
 * Tạo post + media (max 1 ở Phase 2) trong 1 lần create lồng nhau.
 * KHÔNG verify object S3 tồn tại — tin client đã upload (orphan check để Phase polish).
 */
export async function createPost(authorId: string, input: CreatePostInput) {
  return prisma.post.create({
    data: {
      authorId,
      caption: input.caption?.trim() || null,
      visibility: input.visibility,
      media: {
        create: input.media.map((m, index) => ({
          type: m.type,
          url: m.url,
          objectKey: m.objectKey,
          width: m.width,
          height: m.height,
          order: index,
        })),
      },
    },
    include: postInclude,
  });
}

/**
 * Lấy 1 post + check visibility.
 * PRIVATE/FOLLOWERS bởi non-owner → 404 (KHÔNG 403) to prevent existence leak.
 * Follow-based visibility thật sẽ thêm ở Checkpoint 2.3b.
 */
export async function getPostById(postId: string, viewerId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: postInclude,
  });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }

  const isOwner = viewerId === post.authorId;
  if (post.visibility !== 'PUBLIC' && !isOwner) {
    // PRIVATE returns 404 to prevent existence leak
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }

  return post;
}

/**
 * List post của 1 user (cho ProfilePage). Cursor pagination theo (createdAt desc, id desc).
 * - Account private + viewer không phải owner → empty list (follow check để 2.3b).
 * - Visibility từng post: PUBLIC luôn hiện; FOLLOWERS/PRIVATE chỉ owner.
 */
export async function listPostsByUsername(
  username: string,
  viewerId: string | undefined,
  pagination: PaginationInput,
): Promise<{ posts: unknown[]; nextCursor: string | null }> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isPrivate: true },
  });

  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const isOwner = viewerId === user.id;

  // Account-level privacy: private account + người ngoài → chưa cho xem (2.3b thêm follow)
  if (user.isPrivate && !isOwner) {
    return { posts: [], nextCursor: null };
  }

  const where = isOwner
    ? { authorId: user.id }
    : { authorId: user.id, visibility: 'PUBLIC' as const };

  const { cursor, limit } = pagination;

  const rows = await prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // lấy dư 1 để biết còn trang sau
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? posts[posts.length - 1]!.id : null;

  return { posts, nextCursor };
}

/**
 * Cập nhật caption/visibility. Non-owner → 403 (viewer đã chứng minh biết post bằng cách edit).
 */
export async function updatePost(postId: string, userId: string, input: UpdatePostInput) {
  const post = await prisma.post.findUnique({ where: { id: postId } });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }
  if (post.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only edit your own posts');
  }

  const data: { caption?: string | null; visibility?: UpdatePostInput['visibility'] } = {};
  if (input.caption !== undefined) data.caption = input.caption.trim() || null;
  if (input.visibility !== undefined) data.visibility = input.visibility;

  return prisma.post.update({
    where: { id: postId },
    data,
    include: postInclude,
  });
}

/**
 * Xóa post (cascade xóa PostMedia) + best-effort xóa object S3.
 * S3 delete fail → log, KHÔNG throw (DB delete đã commit).
 */
export async function deletePost(postId: string, userId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: { select: { objectKey: true } } },
  });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }
  if (post.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only delete your own posts');
  }

  // Cascade (onDelete: Cascade) tự xóa PostMedia rows.
  await prisma.post.delete({ where: { id: postId } });

  // Best-effort cleanup trên S3 — không chặn việc xóa DB nếu fail.
  for (const m of post.media) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: m.objectKey }),
      );
    } catch (err) {
      console.error(`[deletePost] Failed to delete S3 object ${m.objectKey}:`, err);
    }
  }
}
