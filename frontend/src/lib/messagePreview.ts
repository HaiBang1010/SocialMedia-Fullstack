import { formatDuration } from '@/lib/audio';
import { callStatusLabel } from '@/lib/call';
import type { Message } from '@/types/api';

// One-line preview of a conversation's last message for the conversation list (Phase 5.4a/b).
// Caption wins; otherwise a media summary; otherwise a placeholder. CSS truncates it in the row.
export function formatMessagePreview(message: Message | null): string {
  if (!message) return 'No messages yet';
  // Call (Phase 6): "📞 Missed call" / "📞 Audio call · 5:23" etc. CALL messages have no content.
  if (message.contentType === 'CALL' && message.call) return `📞 ${callStatusLabel(message.call).text}`;
  // Post share (Phase 5.4c): show the optional caption, else a label. (Checked before `content`
  // so a caption-less share still reads as a share, not "Message".)
  if (message.contentType === 'POST_SHARE') return message.content || '📮 Shared a post';
  if (message.content) return message.content; // EMOJI messages fall here → the emoji itself shows

  const media = message.media ?? [];
  if (media.length === 0) return 'Message';
  const first = media[0]!;
  if (first.type === 'VOICE') return `🎤 Voice (${formatDuration(first.duration ?? 0)})`;
  if (first.type === 'STICKER') return 'Sticker';
  if (first.type === 'GIF') return 'GIF';
  if (media.length > 1) return `📎 ${media.length} attachments`;
  return first.type === 'VIDEO' ? '🎥 Video' : '📷 Photo';
}
