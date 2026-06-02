import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  createCommentSchema,
  updateCommentSchema,
  commentResponseSchema,
  commentListResponseSchema,
} from './comments.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const forbidden403 = { description: 'Forbidden — not allowed', ...json(errorResponseSchema) };
const notFound404 = { description: 'Not found', ...json(errorResponseSchema) };

export function registerCommentsOpenApi(registry: OpenAPIRegistry) {
  const Comment = registry.register('Comment', commentResponseSchema);
  const CommentList = registry.register('CommentList', commentListResponseSchema);
  const CreateCommentReq = registry.register('CreateCommentRequest', createCommentSchema);
  const UpdateCommentReq = registry.register('UpdateCommentRequest', updateCommentSchema);
  const idParam = z.object({ id: z.string() });

  registry.registerPath({
    method: 'post',
    path: '/posts/{id}/comments',
    tags: ['Comments'],
    summary: 'Add a comment to a post',
    security: [{ bearerAuth: [] }],
    request: { params: idParam, body: json(CreateCommentReq) },
    responses: {
      201: { description: 'Created comment', ...json(Comment) },
      400: validationError400,
      401: unauthorized401,
      404: { description: 'Post not found', ...json(errorResponseSchema) },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/posts/{id}/comments',
    tags: ['Comments'],
    summary: "List a post's comments (oldest first, cursor pagination)",
    description:
      'Comments are returned oldest-first (createdAt asc). Requires the viewer can see the post; ' +
      'otherwise 404 (existence hidden).',
    // Optional auth: send a bearer token so FOLLOWERS/owner posts are visible to the right viewer.
    security: [{ bearerAuth: [] }, {}],
    request: { params: idParam, query: paginationSchema },
    responses: {
      200: { description: 'Paginated comments', ...json(CommentList) },
      404: { description: 'Post not found', ...json(errorResponseSchema) },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/comments/{id}',
    tags: ['Comments'],
    summary: 'Edit a comment (author only)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam, body: json(UpdateCommentReq) },
    responses: {
      200: { description: 'Updated comment', ...json(Comment) },
      400: validationError400,
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/comments/{id}',
    tags: ['Comments'],
    summary: 'Delete a comment (comment author or post author)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      204: { description: 'Deleted' },
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });
}
