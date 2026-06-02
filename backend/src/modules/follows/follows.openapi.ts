import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { followResponseSchema, userListResponseSchema } from './follows.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const userNotFound404 = { description: 'User not found', ...json(errorResponseSchema) };

export function registerFollowsOpenApi(registry: OpenAPIRegistry) {
  const FollowResult = registry.register('FollowResult', followResponseSchema);
  const UserList = registry.register('UserList', userListResponseSchema);
  const usernameParam = z.object({ username: z.string() });

  registry.registerPath({
    method: 'post',
    path: '/users/{username}/follow',
    tags: ['Follows'],
    summary: 'Follow a user (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: usernameParam },
    responses: {
      200: { description: 'Now following', ...json(FollowResult) },
      400: { description: 'Cannot follow yourself', ...json(errorResponseSchema) },
      401: unauthorized401,
      404: userNotFound404,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/users/{username}/follow',
    tags: ['Follows'],
    summary: 'Unfollow a user (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: usernameParam },
    responses: {
      200: { description: 'No longer following', ...json(FollowResult) },
      401: unauthorized401,
      404: userNotFound404,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}/followers',
    tags: ['Follows'],
    summary: "List a user's followers (cursor pagination)",
    description:
      "A private account's follower list is only visible to the owner and to accounts that " +
      'follow it; others receive an empty list. Send a bearer token to be recognized.',
    // Optional auth: viewer identity gates a private account's list.
    security: [{ bearerAuth: [] }, {}],
    request: { params: usernameParam, query: paginationSchema },
    responses: {
      200: { description: 'Paginated followers', ...json(UserList) },
      404: userNotFound404,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}/following',
    tags: ['Follows'],
    summary: 'List who a user is following (cursor pagination)',
    description:
      "A private account's following list is only visible to the owner and to accounts that " +
      'follow it; others receive an empty list. Send a bearer token to be recognized.',
    // Optional auth: viewer identity gates a private account's list.
    security: [{ bearerAuth: [] }, {}],
    request: { params: usernameParam, query: paginationSchema },
    responses: {
      200: { description: 'Paginated following', ...json(UserList) },
      404: userNotFound404,
    },
  });
}
