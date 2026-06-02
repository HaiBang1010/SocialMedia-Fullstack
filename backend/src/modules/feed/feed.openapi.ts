import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { feedResponseSchema } from './feed.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

export function registerFeedOpenApi(registry: OpenAPIRegistry) {
  const FeedRes = registry.register('FeedResponse', feedResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/feed',
    tags: ['Feed'],
    summary: 'Get personalized feed (posts from following users, chronological)',
    description:
      'Returns posts from users you follow, created in the last 14 days. ' +
      'PUBLIC + FOLLOWERS visibility only (PRIVATE excluded). Cursor pagination; ' +
      'order is chronological (the client shuffles per page).',
    // Auth required — KHÔNG có phần tử {} anonymous như các route optional-auth.
    security: [{ bearerAuth: [] }],
    request: { query: paginationSchema },
    responses: {
      200: { description: 'Feed posts', ...json(FeedRes) },
      400: { description: 'Validation error', ...json(validationErrorResponseSchema) },
      401: { description: 'Unauthorized', ...json(errorResponseSchema) },
    },
  });
}
