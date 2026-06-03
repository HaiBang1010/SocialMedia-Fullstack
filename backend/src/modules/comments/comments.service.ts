import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { getViewablePost } from '../posts/posts.service';
import type { CreateCommentInput, UpdateCommentInput } from './comments.schema';
import type { PaginationInput } from '../posts/posts.schema';

const commentInclude = {
  author: { select: publicUserSelect },
} as const;

/**
 * Create a comment on a post. Requires the viewer can see the post (else 404).
 * parentId is stored but the Phase 2 UI renders flat; if given it must belong to the same post.
 */
export async function createComment(authorId: string, postId: string, input: CreateCommentInput) {
  await getViewablePost(postId, authorId);

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { postId: true },
    });
    if (!parent || parent.postId !== postId) {
      throw new AppError(400, 'InvalidParent', 'Parent comment does not belong to this post');
    }
  }

  return prisma.comment.create({
    data: {
      postId,
      authorId,
      parentId: input.parentId ?? null,
      content: input.content,
    },
    include: commentInclude,
  });
}

/**
 * List a post's comments, newest first (createdAt desc; older comments load on scroll down).
 * Requires the viewer can see the post (else 404). Cursor = comment id of the previous page's last item.
 */
export async function listComments(postId: string, viewerId: string | undefined, pagination: PaginationInput) {
  await getViewablePost(postId, viewerId);

  const { cursor, limit } = pagination;

  const rows = await prisma.comment.findMany({
    where: { postId },
    include: commentInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const comments = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? comments[comments.length - 1]!.id : null;

  return { comments, nextCursor };
}

/**
 * Edit a comment's content. Only the comment's author may edit (else 403).
 */
export async function updateComment(commentId: string, userId: string, input: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    throw new AppError(404, 'CommentNotFound', 'Comment not found');
  }
  if (comment.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only edit your own comments');
  }

  return prisma.comment.update({
    where: { id: commentId },
    data: { content: input.content },
    include: commentInclude,
  });
}

/**
 * Delete a comment. Allowed for the comment's author OR the post's author (moderation).
 * Cascade (onDelete: Cascade on the self-relation) removes replies.
 */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, post: { select: { authorId: true } } },
  });

  if (!comment) {
    throw new AppError(404, 'CommentNotFound', 'Comment not found');
  }
  if (comment.authorId !== userId && comment.post.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only delete your own comments or comments on your post');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}
