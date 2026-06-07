import { z } from 'zod';
import { publicUserSchema } from '../follows/follows.schema';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2200), // trim then require non-empty
  parentId: z.string().optional(), // when set, the comment is a reply (flattened to the root on create)
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(2200),
});

// Cursor pagination for the root comment list (newest-first). Default 10/page.
export const commentListQuerySchema = z.object({
  cursor: z.string().optional(), // comment id of the previous page's last item
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Cursor pagination for a comment's replies (chronological). Default 4/page.
export const replyListQuerySchema = z.object({
  cursor: z.string().optional(), // reply id of the previous page's last item
  limit: z.coerce.number().int().min(1).max(50).default(4),
});

export const commentResponseSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable(), // null for root comments, root id for replies
  content: z.string(),
  createdAt: z.string(), // ISO
  author: publicUserSchema,
  repliesCount: z.number().int().nonnegative(), // 0 for replies (flatten = no nesting)
});

// Shared by GET /posts/:id/comments (root) and GET /comments/:id/replies — same shape.
export const commentListResponseSchema = z.object({
  comments: z.array(commentResponseSchema),
  nextCursor: z.string().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CommentListQuery = z.infer<typeof commentListQuerySchema>;
export type ReplyListQuery = z.infer<typeof replyListQuerySchema>;
