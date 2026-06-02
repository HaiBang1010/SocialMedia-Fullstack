import { z } from 'zod';
import { postResponseSchema } from '../posts/posts.schema';

// Feed = list post (enriched DTO) + cursor. Mỗi item dùng lại postResponseSchema.
// Pagination reuse paginationSchema từ posts module (không khai lại ở đây).
export const feedResponseSchema = z.object({
  posts: z.array(postResponseSchema),
  nextCursor: z.string().nullable(),
});
