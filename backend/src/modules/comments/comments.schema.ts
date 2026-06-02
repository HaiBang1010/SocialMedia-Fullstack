import { z } from 'zod';
import { publicUserSchema } from '../follows/follows.schema';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2200), // trim then require non-empty
  parentId: z.string().optional(), // stored in DB; Phase 2 UI renders flat
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(2200),
});

export const commentResponseSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(), // ISO
  author: publicUserSchema,
});

export const commentListResponseSchema = z.object({
  comments: z.array(commentResponseSchema),
  nextCursor: z.string().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
