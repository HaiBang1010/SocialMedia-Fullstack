import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircleOff, Phone, Video } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import GroupAvatar from './GroupAvatar';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/format';
import { getStatus } from '@/lib/apiError';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useCallStore } from '@/stores/callStore';
import { useConversation } from '@/features/messaging/hooks/useConversation';
import { useConversationSocket } from '@/features/messaging/hooks/useConversationSocket';
import { useAcceptCall } from '@/features/calls/hooks/useAcceptCall';
import { conversationDisplay } from '@/features/messaging/conversationDisplay';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import CallButtons from '@/components/calls/CallButtons';
import ConversationHeaderMenu from './ConversationHeaderMenu';
import type { ReplyPreview } from '@/types/api';

interface ConversationDetailProps {
  conversationId: string;
}

export default function ConversationDetail({ conversationId }: ConversationDetailProps) {
  const navigate = useNavigate();
  const meId = useAuthStore((s) => s.user?.id);
  const { data: conversation, isError, error, refetch } = useConversation(conversationId);

  // Phase Polish — reply target, lifted here so the bubble (in MessageThread) can set it and the
  // composer (MessageInput, a sibling) can preview + send it. Reset on conversation switch.
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  useEffect(() => setReplyingTo(null), [conversationId]);

  // Join the conversation room + bind typing / read-receipt events for this thread (5.2).
  useConversationSocket(conversationId);

  // Phase 6 — "Call in progress · Join" banner for someone not (yet) in the active call.
  const currentCall = useCallStore((s) => s.currentCall);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const acceptCall = useAcceptCall();
  const activeCall = conversation?.activeCall ?? null;
  const showCallBanner =
    !!activeCall &&
    currentCall?.callId !== activeCall.id && // already in it
    incomingCall?.callId !== activeCall.id; // already ringing

  const display = conversation ? conversationDisplay(conversation, meId) : null;
  const otherUserId = display?.otherUserId;
  const otherUsername = display?.otherUsername;

  // Presence (DIRECT only) for the header subtitle + avatar dot.
  const isOnline = usePresenceStore((s) => (otherUserId ? !!s.online[otherUserId] : false));
  const lastSeen = usePresenceStore((s) => (otherUserId ? s.lastSeen[otherUserId] : undefined));

  // Header subtitle = presence only (typing now lives in the thread). DIRECT only.
  let subtitle: string | null = null;
  if (isOnline) {
    subtitle = 'Active now';
  } else if (lastSeen) {
    const rel = formatRelativeTime(lastSeen);
    subtitle = rel === 'now' ? 'Active now' : `Active ${rel} ago`;
  }

  // Invalid / inaccessible conversation (bad id, not a participant, or deleted) → API 404.
  // Early return fills only the detail pane (the desktop list aside lives in MessagesPage),
  // so the conversation list stays visible on desktop. Non-404 → retryable error.
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        {getStatus(error) === 404 ? (
          <EmptyState
            icon={MessageCircleOff}
            title="Conversation not found"
            description="This conversation doesn't exist or you're no longer a member."
            action={<Button onClick={() => navigate('/messages')}>Back to messages</Button>}
          />
        ) : (
          <ErrorState message="Couldn't load this conversation." onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        {/* Back button — mobile only (desktop keeps the list visible alongside). */}
        <button
          type="button"
          onClick={() => navigate('/messages')}
          aria-label="Back"
          className="-ml-1 rounded-full p-1 hover:bg-muted md:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        {!display ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : conversation?.type === 'DIRECT' && otherUsername ? (
          // DIRECT → tap avatar/name to open the other user's profile (GROUP header is not linked
          // until group settings land in 5.5). The mobile back button stays outside this Link.
          <Link
            to={`/users/${otherUsername}`}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50"
          >
            <Avatar user={display.avatarUser} size="sm" online={isOnline} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium leading-tight">{display.title}</span>
              {subtitle && (
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {conversation?.type === 'GROUP' ? (
              <GroupAvatar users={conversation.participants.map((p) => p.user)} size="sm" />
            ) : (
              <Avatar user={display.avatarUser} size="sm" online={isOnline} />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium leading-tight">{display.title}</span>
              {subtitle && (
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Phase 6 — Audio + Video call buttons (DIRECT + GROUP). The name block above is flex-1,
            so these sit at the right edge of the header. */}
        {conversation && (
          <CallButtons conversationId={conversationId} isGroup={conversation.type === 'GROUP'} />
        )}
        {/* Group management — add members / leave (GROUP only; DIRECT shows nothing). */}
        {conversation?.type === 'GROUP' && <ConversationHeaderMenu conversation={conversation} />}
      </header>

      {showCallBanner && activeCall && conversation && (
        <button
          type="button"
          onClick={() =>
            acceptCall.mutate({
              callId: activeCall.id,
              conversationId,
              type: activeCall.type,
              isGroup: conversation.type === 'GROUP',
            })
          }
          disabled={acceptCall.isPending}
          className="flex shrink-0 items-center justify-between gap-2 border-b bg-primary/10 px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
        >
          <span className="flex items-center gap-2 font-medium">
            {activeCall.type === 'VIDEO' ? <Video className="size-4" /> : <Phone className="size-4" />}
            Call in progress
          </span>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {acceptCall.isPending ? 'Joining…' : 'Join'}
          </span>
        </button>
      )}

      <MessageThread
        conversationId={conversationId}
        conversationType={conversation?.type}
        participants={conversation?.participants}
        onReply={setReplyingTo}
      />
      <MessageInput
        conversationId={conversationId}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
}
