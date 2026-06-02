import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { likeResponseSchema } from './likes.schema';
import { errorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const notFound404 = { description: 'Post not found', ...json(errorResponseSchema) };

export function registerLikesOpenApi(registry: OpenAPIRegistry) {
  const LikeResult = registry.register('LikeResult', likeResponseSchema);
  const idParam = z.object({ id: z.string() });

  registry.registerPath({
    method: 'post',
    path: '/posts/{id}/like',
    tags: ['Likes'],
    summary: 'Like a post (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'Liked', ...json(LikeResult) },
      401: unauthorized401,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/posts/{id}/like',
    tags: ['Likes'],
    summary: 'Unlike a post (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'Unliked', ...json(LikeResult) },
      401: unauthorized401,
    },
  });
}
