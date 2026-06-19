import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { serializeMessage } from '../messages/messages.service';
import { emitMemberAdded, emitMemberLeft } from '../../socket/io';
import type { CreateGroupInput } from './conversations.schema';
import type { PaginationInput } from '../posts/posts.schema';

// include shared by every endpoint returning a conversation: participants (each with their
// public user) + the newest non-deleted message as the list preview (lastMessage).
const conversationInclude = {
  participants: { include: { user: { select: publicUserSelect } } },
  // Phase 6 — the single active call (if any) for the "Call in progress · Join" banner. endedAt
  // null = ongoing; newest first (defensive, normally ≤1 active per conversation).
  calls: {
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' },
    take: 1,
    include: { initiator: { select: publicUserSelect } },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    // reactions + media + sharedPost + call kept here too (5.3a/5.4a/5.4c/6) so serializeMessage's
    // input type matches messageInclude (type parity); the lastMessage preview carries them at
    // negligible cost (one message per conversation).
    include: {
      sender: { select: publicUserSelect },
      reactions: { orderBy: { createdAt: 'asc' } },
      media: { orderBy: { order: 'asc' } },
      sharedPost: {
        include: {
          author: { select: publicUserSelect },
          media: { orderBy: { order: 'asc' }, take: 1 },
        },
      },
      call: {
        include: {
          initiator: { select: publicUserSelect },
        },
      },
      // Phase Polish — reply preview, SAME narrow select as messageInclude.replyTo (type parity:
      // serializeMessage is shared, so the lastMessage preview must carry replyTo too).
      replyTo: {
        select: {
          id: true,
          contentType: true,
          content: true,
          deletedAt: true,
          sender: { select: publicUserSelect },
        },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

/**
 * Transform a Prisma conversation into the API DTO. WHITELIST — directKey (a server-only
 * dedup key) is never exposed. lastMessage = the newest non-deleted message, or null.
 */
function serializeConversation(convo: ConversationRow, unreadCount = 0) {
  return {
    id: convo.id,
    type: convo.type,
    name: convo.name,
    avatarUrl: convo.avatarUrl,
    createdAt: convo.createdAt.toISOString(),
    lastMessageAt: convo.lastMessageAt.toISOString(),
    // Phase 7 — the viewer's unread count (non-deleted, non-own messages newer than their read
    // cursor). Computed per page in listConversations; 0 on create/get paths.
    unreadCount,
    participants: convo.participants.map((p) => ({
      user: p.user,
      isAdmin: p.isAdmin,
      // Phase 5.2 — drives the "Seen" indicator (each member's last-read message).
      lastReadMessageId: p.lastReadMessageId,
    })),
    lastMessage: convo.messages[0] ? serializeMessage(convo.messages[0]) : null,
    // Phase 6 — active call (ongoing), null when none. Shape mirrors a message's `call` card
    // (endedAt/endedReason are null while active).
    activeCall: convo.calls[0]
      ? {
          id: convo.calls[0].id,
          type: convo.calls[0].type,
          startedAt: convo.calls[0].startedAt.toISOString(),
          endedAt: null,
          endedReason: null,
          initiator: convo.calls[0].initiator,
        }
      : null,
  };
}

/** Deterministic, order-independent unique key for the DIRECT conversation of two users. */
function directKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

/**
 * Find (or create) the 1-1 conversation between two users. Race-safe + idempotent via the
 * directKey UNIQUE constraint + upsert — the same "upsert on a unique key" idiom the repo
 * uses for Follow/Like/StoryView, so two fast clicks can never create duplicates and no
 * transaction is needed.
 */
export async function findOrCreateDirectConversation(meId: string, targetUserId: string) {
  if (targetUserId === meId) {
    throw new AppError(400, 'CannotMessageSelf', 'You cannot start a conversation with yourself');
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const directKey = directKeyFor(meId, targetUserId);
  const convo = await prisma.conversation.upsert({
    where: { directKey },
    create: {
      type: 'DIRECT',
      directKey,
      participants: { create: [{ userId: meId }, { userId: targetUserId }] },
    },
    update: {}, // already exists → no-op, return it
    include: conversationInclude,
  });
  return serializeConversation(convo);
}

/**
 * Build a default group name from member display names (Phase 5.5, Q2): "Group with A, B, C"
 * for up to three, "+ and N others" beyond that.
 */
function deriveGroupName(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const base = `Group with ${shown.join(', ')}`;
  return rest > 0 ? `${base} and ${rest} other${rest > 1 ? 's' : ''}` : base;
}

/**
 * Create a GROUP conversation. participantIds are the OTHER members; the creator is added
 * as admin. Dedupes ids, drops the creator if present, and requires ≥2 other valid members.
 * name is optional — when blank, auto-derived from the members' display names (Q2).
 */
export async function createGroupConversation(creatorId: string, input: CreateGroupInput) {
  const otherIds = [...new Set(input.participantIds)].filter((id) => id !== creatorId);
  if (otherIds.length < 2) {
    throw new AppError(400, 'InvalidParticipants', 'A group needs at least two other participants');
  }

  const found = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, name: true },
  });
  if (found.length !== otherIds.length) {
    throw new AppError(400, 'InvalidParticipants', 'One or more participants do not exist');
  }

  // Auto-derive a friendly name when the creator didn't provide one (single source of truth, E1).
  const name = input.name?.trim() || deriveGroupName(found.map((u) => u.name));

  const convo = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name,
      participants: {
        create: [
          { userId: creatorId, isAdmin: true },
          ...otherIds.map((id) => ({ userId: id, isAdmin: false })),
        ],
      },
    },
    include: conversationInclude,
  });
  return serializeConversation(convo);
}

/**
 * Phase 7 — unread counts for a page of conversations, in ONE query. For each conversation the
 * viewer is in, count non-deleted messages NOT sent by them that are newer than their read cursor
 * (lastReadMessageId's createdAt). COALESCE('-infinity') handles the never-read case (null cursor
 * → count all). COUNT(*)::int avoids a BigInt (which res.json can't serialize). Returns a Map
 * keyed by conversation id; conversations with zero unread are simply absent (default to 0).
 */
async function unreadCountsFor(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ conversationId: string; unread: number }[]>(Prisma.sql`
    SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS unread
    FROM "Message" m
    JOIN "Participant" p ON p."conversationId" = m."conversationId" AND p."userId" = ${userId}
    LEFT JOIN "Message" lr ON lr."id" = p."lastReadMessageId"
    WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
      AND m."deletedAt" IS NULL
      AND m."senderId" <> ${userId}
      AND m."createdAt" > COALESCE(lr."createdAt", '-infinity'::timestamp)
    GROUP BY m."conversationId"
  `);
  return new Map(rows.map((r) => [r.conversationId, r.unread]));
}

/** Grand total unread across ALL the viewer's conversations (the nav badge). Single aggregate. */
export async function getUnreadTotal(userId: string) {
  const rows = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS total
    FROM "Message" m
    JOIN "Participant" p ON p."conversationId" = m."conversationId" AND p."userId" = ${userId}
    LEFT JOIN "Message" lr ON lr."id" = p."lastReadMessageId"
    WHERE m."deletedAt" IS NULL
      AND m."senderId" <> ${userId}
      AND m."createdAt" > COALESCE(lr."createdAt", '-infinity'::timestamp)
  `);
  return { total: rows[0]?.total ?? 0 };
}

/**
 * The viewer's conversations, most-recent activity first (lastMessageAt desc, id desc).
 * Cursor on id. Non-members simply never match the `some` filter.
 */
export async function listConversations(userId: string, pagination: PaginationInput) {
  const { cursor, limit } = pagination;

  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: conversationInclude,
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  const unread = await unreadCountsFor(userId, slice.map((c) => c.id));

  return {
    conversations: slice.map((c) => serializeConversation(c, unread.get(c.id) ?? 0)),
    nextCursor,
  };
}

/**
 * One conversation by id. READ: a non-participant (or a missing id) gets 404 — existence
 * hidden (mirrors getViewablePost PRIVATE → 404, per prefer-404-over-403-private).
 */
export async function getConversation(conversationId: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!convo || !convo.participants.some((p) => p.userId === userId)) {
    throw new AppError(404, 'ConversationNotFound', 'Conversation not found');
  }
  return serializeConversation(convo);
}

/**
 * Add members to a GROUP conversation (open permission — any member can add anyone). Requester
 * must be a member (else 404, existence hidden). DIRECT → 400. Self / existing / non-existent ids
 * are filtered out silently (idempotent + race-safe via createMany skipDuplicates). Returns the
 * updated conversation and fans `conversation:member-added` to every (post-add) participant's
 * user room so the group appears in new members' lists even with the thread closed.
 */
export async function addMembers(conversationId: string, userIds: string[], requesterId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, participants: { select: { userId: true } } },
  });
  if (!convo || !convo.participants.some((p) => p.userId === requesterId)) {
    throw new AppError(404, 'ConversationNotFound', 'Conversation not found');
  }
  if (convo.type !== 'GROUP') {
    throw new AppError(400, 'CannotAddToDirect', 'You can only add members to a group conversation');
  }

  const existing = new Set(convo.participants.map((p) => p.userId));
  const requested = [...new Set(userIds)].filter((id) => id !== requesterId && !existing.has(id));

  let addedIds: string[] = [];
  if (requested.length > 0) {
    const found = await prisma.user.findMany({
      where: { id: { in: requested } },
      select: { id: true },
    });
    addedIds = found.map((u) => u.id);
    if (addedIds.length > 0) {
      await prisma.participant.createMany({
        data: addedIds.map((uid) => ({ conversationId, userId: uid, isAdmin: false })),
        skipDuplicates: true,
      });
    }
  }

  const updated = await getConversation(conversationId, requesterId);
  if (addedIds.length > 0) {
    emitMemberAdded(
      updated.participants.map((p) => p.user.id),
      { conversationId, addedUserIds: addedIds },
    );
  }
  return updated;
}

/**
 * Leave a GROUP conversation (anyone can leave). Member-only (else 404); DIRECT → 400. Deletes the
 * leaver's Participant row. If they were the LAST member, the whole conversation is deleted
 * (cascade removes participants/messages/media/reactions/calls — no zombie groups). Emits
 * `conversation:member-left` to the remaining members + the leaver's own other tabs.
 */
export async function leaveConversation(conversationId: string, userId: string): Promise<void> {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, participants: { select: { userId: true } } },
  });
  if (!convo || !convo.participants.some((p) => p.userId === userId)) {
    throw new AppError(404, 'ConversationNotFound', 'Conversation not found');
  }
  if (convo.type !== 'GROUP') {
    throw new AppError(400, 'CannotLeaveDirect', 'You can only leave a group conversation');
  }

  const allIds = convo.participants.map((p) => p.userId); // pre-delete (includes the leaver)
  await prisma.participant.delete({
    where: { conversationId_userId: { conversationId, userId } },
  });

  if (allIds.length <= 1) {
    // Last member out → delete the group + cascade everything (no zombie groups).
    await prisma.conversation.delete({ where: { id: conversationId } });
    emitMemberLeft([userId], { conversationId, userId, deleted: true });
  } else {
    // Notify remaining members (detail/list refresh) + the leaver's own other tabs.
    emitMemberLeft(allIds, { conversationId, userId, deleted: false });
  }
}
