import { z } from 'zod';
import { MediaType } from '@prisma/client';

/**
 * Body for POST /stories. One story = ONE media item (image or video) — fields are
 * flat (no media[] array like posts). The client already uploaded the file to S3
 * (presign at /media/presign) and passes back the url + objectKey it received.
 * Backend does NOT verify the object exists (trusts the client, mirroring posts).
 * No caption in Phase 4.1.
 */
export const createStorySchema = z
  .object({
    mediaType: z.nativeEnum(MediaType).default('IMAGE'),
    mediaUrl: z.string().url(),
    mediaObjectKey: z.string().min(1),
    // Video only: poster image extracted client-side, uploaded as JPEG.
    // thumbnailObjectKey lets deleteStory clean the poster up alongside the video.
    thumbnailUrl: z.string().url().optional(),
    thumbnailObjectKey: z.string().min(1).optional(),
    duration: z.number().int().positive().optional(), // video length in seconds
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  // A video story must carry a poster so the ring/preview has something to show.
  .refine(
    (data) =>
      data.mediaType !== 'VIDEO' || (!!data.thumbnailUrl && !!data.thumbnailObjectKey),
    { message: 'A video story requires a thumbnail' },
  );

// ── Response shapes (cho OpenAPI doc) ──
// author dùng đúng các field của publicUserSelect (loại email/passwordHash).
const storyAuthorSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
});

export const storyResponseSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  mediaUrl: z.string().url(),
  mediaType: z.nativeEnum(MediaType),
  thumbnailUrl: z.string().url().nullable(),
  duration: z.number().int().nullable(), // video seconds, null for images
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  createdAt: z.string(), // ISO
  expiresAt: z.string(), // ISO
  author: storyAuthorSchema,
  isViewedByMe: z.boolean(),
});

// GET /stories/feed — active stories of followed users, grouped by author.
export const storyFeedItemSchema = z.object({
  user: storyAuthorSchema,
  stories: z.array(storyResponseSchema),
  hasUnseenStory: z.boolean(),
});

export const storyFeedResponseSchema = z.object({
  items: z.array(storyFeedItemSchema),
});

// GET /users/:username/stories — one user's active stories.
export const userStoriesResponseSchema = z.object({
  stories: z.array(storyResponseSchema),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
