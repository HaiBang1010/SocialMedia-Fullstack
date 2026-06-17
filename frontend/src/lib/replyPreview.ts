import type { Message, ReplyPreview } from '@/types/api';

// Phase Polish — shared helpers for reply-to. Used by the quote bubble (MessageBubble) and the
// "Replying to X" composer preview (MessageInput).

// A short content label for a quoted message. Text/emoji show their text (truncated by CSS at the
// call site); other kinds show a type word. A recalled original shows "Message deleted".
export function replyPreviewLabel(reply: ReplyPreview): string {
  if (reply.deletedAt) return 'Message deleted';
  switch (reply.contentType) {
    case 'TEXT':
    case 'EMOJI':
      return reply.content ?? '';
    case 'IMAGE':
      return 'Photo';
    case 'VIDEO':
      return 'Video';
    case 'VOICE':
      return 'Voice message';
    case 'STICKER':
      return 'Sticker';
    case 'GIF':
      return 'GIF';
    case 'POST_SHARE':
      return 'Shared post';
    case 'CALL':
      return 'Call';
    default:
      return '';
  }
}

// Display name for the quoted message's author (name, falling back to username).
export function replyAuthorName(reply: ReplyPreview): string {
  return reply.sender.name || reply.sender.username;
}

// Build a ReplyPreview (the reply TARGET) from a full message in the thread — used when the user
// taps "Reply" on a bubble. deletedAt defaults to null (a live message has no tombstone marker).
export function toReplyPreview(message: Message): ReplyPreview {
  return {
    id: message.id,
    contentType: message.contentType,
    content: message.content,
    deletedAt: message.deletedAt ?? null,
    sender: message.sender,
  };
}
