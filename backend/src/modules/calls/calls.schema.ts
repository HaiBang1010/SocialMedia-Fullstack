import { z } from 'zod';
import { CallType, CallEndReason } from '@prisma/client';
import { messageResponseSchema } from '../messages/messages.schema';

// Body for POST /calls/start — open a call in an existing conversation.
export const startCallSchema = z.object({
  conversationId: z.string().cuid(),
  type: z.nativeEnum(CallType),
});

// Body for POST /calls/:id/end — `leave` (this user leaves; group calls continue unless the room
// drains) vs `end_for_all` (initiator/DIRECT ends for everyone). reason is optional and trusted
// (webhook deferred): 'MISSED' for the 30s timeout, 'FAILED' for a connect error; defaults COMPLETED.
export const endCallSchema = z.object({
  action: z.enum(['leave', 'end_for_all']),
  reason: z.nativeEnum(CallEndReason).optional(),
});

// 201 for /calls/start: the CALL message (appears in the thread) + the initiator's LiveKit token
// + the wss URL. token is also needed by joiners via /calls/:id/token.
export const callStartResponseSchema = z.object({
  message: messageResponseSchema,
  token: z.string(),
  url: z.string(),
});

// 200 for /calls/:id/token — a fresh LiveKit access token for a joining participant.
export const callTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
});

export type StartCallInput = z.infer<typeof startCallSchema>;
export type EndCallInput = z.infer<typeof endCallSchema>;
