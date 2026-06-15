import type { Message } from '@/types/api';

// One-line preview of a conversation's last message for the conversation list (Phase 5.4a).
// Caption wins; otherwise a media summary; otherwise a placeholder. CSS truncates it in the row.
export function formatMessagePreview(message: Message | null): string {
  if (!message) return 'No messages yet';
  if (message.content) return message.content;

  const media = message.media ?? [];
  if (media.length === 0) return 'Message';
  if (media.length > 1) return `📎 ${media.length} attachments`;
  return media[0]!.type === 'VIDEO' ? '🎥 Video' : '📷 Photo';
}
