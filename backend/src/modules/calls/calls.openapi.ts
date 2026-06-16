import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { startCallSchema, endCallSchema, callStartResponseSchema, callTokenResponseSchema } from './calls.schema';
import { messageResponseSchema } from '../messages/messages.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const forbidden403 = { description: 'Forbidden — not a participant', ...json(errorResponseSchema) };
const callNotFound404 = { description: 'Call not found', ...json(errorResponseSchema) };

// Registered AFTER messages so callStartResponseSchema / Message responses $ref the Message component.
export function registerCallsOpenApi(registry: OpenAPIRegistry) {
  const StartCallReq = registry.register('StartCallRequest', startCallSchema);
  const EndCallReq = registry.register('EndCallRequest', endCallSchema);
  const CallStartRes = registry.register('CallStartResponse', callStartResponseSchema);
  const CallTokenRes = registry.register('CallTokenResponse', callTokenResponseSchema);
  const idParam = z.object({ id: z.string() });

  registry.registerPath({
    method: 'post',
    path: '/calls/start',
    tags: ['Calls'],
    summary: 'Start an audio/video call in a conversation (participant only)',
    security: [{ bearerAuth: [] }],
    request: { body: json(StartCallReq) },
    responses: {
      201: { description: 'CALL message + initiator LiveKit token', ...json(CallStartRes) },
      400: validationError400,
      401: unauthorized401,
      403: forbidden403,
      409: { description: 'A call is already in progress', ...json(errorResponseSchema) },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/calls/{id}/token',
    tags: ['Calls'],
    summary: 'Get a LiveKit access token to join a call (the accept path)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'Access token + server URL', ...json(CallTokenRes) },
      401: unauthorized401,
      403: forbidden403,
      404: callNotFound404,
      409: { description: 'Call is full (50 participants)', ...json(errorResponseSchema) },
      410: { description: 'Call has ended', ...json(errorResponseSchema) },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/calls/{id}/decline',
    tags: ['Calls'],
    summary: 'Decline an incoming call (recipient)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'The CALL message', ...json(messageResponseSchema) },
      401: unauthorized401,
      403: forbidden403,
      404: callNotFound404,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/calls/{id}/end',
    tags: ['Calls'],
    summary: 'Leave a call or end it for everyone (initiator)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam, body: json(EndCallReq) },
    responses: {
      200: { description: 'The (possibly updated) CALL message', ...json(messageResponseSchema) },
      400: validationError400,
      401: unauthorized401,
      403: forbidden403,
      404: callNotFound404,
    },
  });
}
