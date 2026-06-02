import { z } from 'zod';

/**
 * Public user shape — mirrors `publicUserSelect` (no email/passwordHash).
 * Used for follower/following list items.
 */
export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(), // ISO
});

export const followResponseSchema = z.object({
  following: z.boolean(),
});

export const userListResponseSchema = z.object({
  users: z.array(publicUserSchema),
  nextCursor: z.string().nullable(),
});
