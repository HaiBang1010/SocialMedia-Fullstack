import { CallType, CallEndReason, MessageContentType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import {
  isParticipant,
  getParticipantIds,
  serializeMessage,
  messageInclude,
} from '../messages/messages.service';
import {
  generateAccessToken,
  createCallRoom,
  getRoomParticipantCount,
  deleteRoom,
  livekitUrl,
  MAX_CALL_PARTICIPANTS,
} from '../../lib/livekit';
import {
  emitNewMessage,
  emitCallIncoming,
  emitCallDeclined,
  emitCallEnded,
} from '../../socket/io';

/**
 * Phase 6 — Calls over LiveKit Cloud. LiveKit handles all WebRTC signaling; the backend only
 * mints access tokens, tracks lifecycle (Call rows), and surfaces each call in the thread as a
 * CALL message (Call-as-Message — reuses Phase 5.4c sharedPost infra). Webhook is deferred, so
 * missed/ended is driven by client actions + an empty-room timeout backstop.
 */

// A call whose LiveKit room is empty AND older than this is treated as a ghost (reaped on the next
// start attempt). A ringing call isn't empty (the initiator is connected = 1 participant), so this
// only needs to exceed the brief createCall→initiator-connect window; 15s is safe + reaps faster
// than the old 60s when pagehide cleanup is missed.
const STALE_CALL_MS = 15_000;

// Minimum duration for a call to count as "connected". Without an explicit reason, finalizeCall's
// callers infer COMPLETED for a call that ran ≥ this (it almost certainly connected) and FAILED for
// a shorter one (never really did). Explicit reasons (MISSED on no-answer, DECLINED) bypass this.
const CONNECTED_MIN_MS = 10_000;
function inferEndReason(startedAt: Date): CallEndReason {
  return Date.now() - startedAt.getTime() >= CONNECTED_MIN_MS
    ? CallEndReason.COMPLETED
    : CallEndReason.FAILED;
}

/** Load a call + the bits of its conversation we need (type for DIRECT/GROUP behaviour). 404 if gone. */
async function getCallOr404(callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { conversation: { select: { type: true } } },
  });
  if (!call) throw new AppError(404, 'CallNotFound', 'Call not found');
  return call;
}

/** Re-read + serialize the CALL message tied to a call (one per call in practice). */
async function getCallMessageDTO(callId: string) {
  const message = await prisma.message.findFirst({
    where: { callId },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
  });
  if (!message) throw new AppError(404, 'MessageNotFound', 'Call message not found');
  return serializeMessage(message);
}

/** Stamp endedAt + reason on a call, then broadcast call:ended to everyone and return the
 *  (now-updated) CALL message DTO. Re-reads the message AFTER the update so `call.endedAt` is fresh. */
async function finalizeCall(callId: string, reason: CallEndReason) {
  const endedAt = new Date();
  const call = await prisma.call.update({
    where: { id: callId },
    data: { endedAt, endedReason: reason },
  });
  // Tear the LiveKit room down so any still-connected participants are force-disconnected (their
  // onDisconnected → leave). Covers "end for everyone" + the last-participant cleanup robustly,
  // independent of whether each client's call:ended socket handler runs. Soft-fail.
  await deleteRoom(callId);
  const dto = await getCallMessageDTO(callId);
  emitCallEnded(await getParticipantIds(call.conversationId), {
    callId,
    conversationId: call.conversationId,
    endedAt: endedAt.toISOString(),
    endedReason: reason,
  });
  return dto;
}

/**
 * Start a call in an existing conversation. Validates membership (403), blocks self-only calls
 * (400) and concurrent calls (409, DB-query — Decision Q8). Creates the Call (its id IS the
 * LiveKit room name), provisions the room (cap 50 + empty-timeout — Q2), inserts the CALL message
 * (appears in everyone's thread via message:new), rings the other participants (call:incoming),
 * and returns the initiator's access token.
 */
export async function createCall(initiatorId: string, conversationId: string, type: CallType) {
  if (!(await isParticipant(conversationId, initiatorId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true, name: true, participants: { select: { userId: true } } },
  });
  if (!conversation) throw new AppError(404, 'ConversationNotFound', 'Conversation not found');

  const participantIds = conversation.participants.map((p) => p.userId);
  const others = participantIds.filter((id) => id !== initiatorId);
  if (others.length === 0) {
    throw new AppError(400, 'CannotCallSelf', 'You cannot start a call with only yourself');
  }

  // Concurrent-call block (Q8): one active call per conversation, and one per initiator. But a
  // ghost (a call whose participants all dropped without ending it — tab close / crash, webhook
  // deferred) would otherwise block forever. STALE-LOCK detection: if the "active" call's LiveKit
  // room is empty AND it's older than STALE_CALL_MS (longer than the connect+ring window, so we
  // don't reap a call that's merely still connecting), finalize it and continue. Otherwise it's
  // genuinely active (or still ringing) → 409 carrying the existing call so the client can join.
  const active = await prisma.call.findFirst({
    where: { endedAt: null, OR: [{ conversationId }, { initiatorId }] },
    orderBy: { startedAt: 'desc' },
    select: { id: true, conversationId: true, type: true, startedAt: true, conversation: { select: { type: true } } },
  });
  if (active) {
    const liveCount = await getRoomParticipantCount(active.id);
    const isStale = liveCount === 0 && Date.now() - active.startedAt.getTime() > STALE_CALL_MS;
    if (isStale) {
      // Reap the ghost with a duration-inferred reason (a long call whose tabs both closed →
      // COMPLETED, not FAILED), then fall through to create the new call.
      await finalizeCall(active.id, inferEndReason(active.startedAt));
    } else {
      throw new AppError(409, 'CallInProgress', 'There is already an active call', {
        callId: active.id,
        conversationId: active.conversationId,
        type: active.type,
        isGroup: active.conversation.type === 'GROUP',
      });
    }
  }

  const call = await prisma.call.create({ data: { conversationId, initiatorId, type } });
  await createCallRoom(call.id);

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: initiatorId,
      contentType: MessageContentType.CALL,
      callId: call.id,
    },
    include: messageInclude,
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });
  await prisma.participant.update({
    where: { conversationId_userId: { conversationId, userId: initiatorId } },
    data: { lastReadMessageId: message.id },
  });

  const serialized = serializeMessage(message);

  // CALL entry in everyone's thread + ring the others.
  emitNewMessage(conversationId, serialized, participantIds);
  emitCallIncoming(others, {
    callId: call.id,
    conversationId,
    type,
    isGroup: conversation.type === 'GROUP',
    initiator: serialized.sender,
    conversationName: conversation.name,
  });

  const token = await generateAccessToken(initiatorId, serialized.sender.username, call.id);
  return { message: serialized, token, url: livekitUrl };
}

/**
 * Mint an access token for a participant joining an existing call (the "accept" path; the
 * initiator learns of the join via LiveKit's ParticipantConnected event). 403 non-participant,
 * 410 ended, 409 when the room is at the 50-cap (Q2 — LiveKit also hard-enforces via maxParticipants).
 */
export async function getCallAccessToken(callId: string, userId: string) {
  const call = await getCallOr404(callId);
  if (!(await isParticipant(call.conversationId, userId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }
  if (call.endedAt) throw new AppError(410, 'CallEnded', 'This call has ended');
  if ((await getRoomParticipantCount(call.id)) >= MAX_CALL_PARTICIPANTS) {
    throw new AppError(409, 'CallFull', 'This call is full');
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  const token = await generateAccessToken(userId, user?.username ?? userId, call.id);
  return { token, url: livekitUrl };
}

/**
 * End or leave a call (Decision Q1). DIRECT: any participant's `leave` ends the call. GROUP:
 * `leave` keeps the room open unless it drains to <= 1 participant (auto-end via listParticipants);
 * `end_for_all` is initiator-only and ends for everyone. Idempotent on an already-ended call.
 */
export async function endCall(
  callId: string,
  userId: string,
  action: 'leave' | 'end_for_all',
  reason?: CallEndReason,
) {
  const call = await getCallOr404(callId);
  if (!(await isParticipant(call.conversationId, userId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }
  if (call.endedAt) return getCallMessageDTO(call.id); // idempotent

  const isDirect = call.conversation.type === 'DIRECT';

  if (action === 'end_for_all') {
    if (!isDirect && call.initiatorId !== userId) {
      throw new AppError(403, 'Forbidden', 'Only the initiator can end a group call for everyone');
    }
    return finalizeCall(call.id, reason ?? inferEndReason(call.startedAt));
  }

  // action === 'leave'
  if (isDirect) {
    return finalizeCall(call.id, reason ?? inferEndReason(call.startedAt));
  }
  // GROUP leave: auto-end only when the room is down to one (or empty). Race with the caller's
  // own LiveKit disconnect is tolerated; emptyTimeout (10m) is the backstop.
  const remaining = await getRoomParticipantCount(call.id);
  if (remaining <= 1) {
    return finalizeCall(call.id, reason ?? inferEndReason(call.startedAt));
  }
  return getCallMessageDTO(call.id); // call continues unchanged
}

/**
 * Recipient explicitly declines an incoming call. DIRECT → ends the call as DECLINED (call:ended
 * to all patches the thread) AND notifies the initiator (call:declined closes their ringing UI).
 * GROUP → the room stays open (Q6); only notify the initiator the user declined.
 */
export async function declineCall(callId: string, userId: string) {
  const call = await getCallOr404(callId);
  if (!(await isParticipant(call.conversationId, userId))) {
    throw new AppError(403, 'Forbidden', 'You are not a participant of this conversation');
  }
  if (call.endedAt) return getCallMessageDTO(call.id); // idempotent

  if (call.conversation.type === 'DIRECT') {
    const dto = await finalizeCall(call.id, CallEndReason.DECLINED);
    emitCallDeclined(call.initiatorId, { callId: call.id, conversationId: call.conversationId, userId });
    return dto;
  }

  emitCallDeclined(call.initiatorId, { callId: call.id, conversationId: call.conversationId, userId });
  return getCallMessageDTO(call.id);
}
