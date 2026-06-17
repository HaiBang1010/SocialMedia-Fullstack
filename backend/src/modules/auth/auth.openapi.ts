import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { registerSchema, loginSchema } from './auth.schema';
import {
  errorResponseSchema,
  validationErrorResponseSchema,
  userPublicSchema,
} from '../../lib/openapi';

// Phase Polish — login/register return { user, accessToken }; the refresh token is delivered as an
// httpOnly Set-Cookie, not in the body.
const authResponseSchema = z.object({
  user: userPublicSchema,
  accessToken: z.string(),
});

const refreshResponseSchema = z.object({ accessToken: z.string() });
const meResponseSchema = z.object({ user: userPublicSchema });

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

// Schemas were registered via registry.register() in lib/openapi.ts,
// so referencing them here auto-emits $ref instead of inlining.
const validationError400 = {
  description: 'Validation error',
  content: { 'application/json': { schema: validationErrorResponseSchema } },
};
const unauthorized401 = {
  description: 'Unauthorized',
  content: { 'application/json': { schema: errorResponseSchema } },
};
const conflict409 = {
  description: 'Conflict — username/email already exists',
  content: { 'application/json': { schema: errorResponseSchema } },
};
export function registerAuthOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Auth'],
    summary: 'Create a new user account',
    request: { body: json(registerSchema) },
    responses: {
      201: { description: 'Created (+ refreshToken httpOnly cookie)', ...json(authResponseSchema) },
      400: validationError400,
      409: conflict409,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Login with email or username',
    request: { body: json(loginSchema) },
    responses: {
      200: { description: 'Login successful (+ refreshToken httpOnly cookie)', ...json(authResponseSchema) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Exchange the refreshToken httpOnly cookie for a new access token',
    responses: {
      200: { description: 'New access token issued', ...json(refreshResponseSchema) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/auth/me',
    tags: ['Auth'],
    summary: 'Get the currently authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Current user', ...json(meResponseSchema) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Clear the refreshToken httpOnly cookie',
    responses: {
      204: { description: 'Logged out (refresh cookie cleared)' },
    },
  });
}
