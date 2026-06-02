import { z } from 'zod';

export const likeResponseSchema = z.object({
  liked: z.boolean(),
  likesCount: z.number().int(),
});
