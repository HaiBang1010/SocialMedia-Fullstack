import { useState } from 'react';
import { useRecallMessage } from '@/features/messaging/hooks/useRecallMessage';
import type { Message } from '@/types/api';

// Mirror the backend RECALL_WINDOW_MS — the client disables the action as a UX guard; the server
// is the authority (returns 410 past the window). A small clock drift just means a doomed request
// that rolls back optimistically.
const RECALL_WINDOW_MS = 15 * 60 * 1000;

// Phase Polish — the recall (delete) confirm flow for one message, owned ONCE per MessageBubble.
// Both the desktop "…" menu (RecallMenu) and the mobile long-press action menu trigger it by
// calling setConfirmOpen(true); the confirm dialog itself lives at the bubble level so it survives
// those transient popovers closing.
export function useRecallFlow(message: Message) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const recall = useRecallMessage(message.conversationId);

  const withinWindow = Date.now() - new Date(message.createdAt).getTime() <= RECALL_WINDOW_MS;

  const handleConfirm = () => {
    recall.mutate(message.id, {
      onSuccess: () => setConfirmOpen(false),
      onError: () => setConfirmOpen(false), // optimistic patch already rolled back
    });
  };

  return { withinWindow, confirmOpen, setConfirmOpen, handleConfirm, isPending: recall.isPending };
}
