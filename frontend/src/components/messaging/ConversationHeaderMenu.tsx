import { useState } from 'react';
import { LogOut, MoreVertical, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AddMembersDialog from './AddMembersDialog';
import LeaveGroupConfirmDialog from './LeaveGroupConfirmDialog';
import { useLeaveConversation } from '@/features/messaging/hooks/useLeaveConversation';
import type { Conversation } from '@/types/api';

interface ConversationHeaderMenuProps {
  conversation: Conversation;
}

// Group management — the "⋮" header menu (GROUP only; the caller gates DIRECT). Two actions:
// add members (open permission) + leave group. Popover shape mirrors RecallMenu.
export default function ConversationHeaderMenu({ conversation }: ConversationHeaderMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const leave = useLeaveConversation();

  const existingMemberIds = conversation.participants.map((p) => p.user.id);
  const isLastMember = conversation.participants.length === 1;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Group options"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <MoreVertical className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-44 p-1">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setShowAdd(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <UserPlus className="size-4" />
            Add members
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setShowLeave(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" />
            Leave group
          </button>
        </PopoverContent>
      </Popover>

      <AddMembersDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        conversationId={conversation.id}
        existingMemberIds={existingMemberIds}
      />
      <LeaveGroupConfirmDialog
        open={showLeave}
        onOpenChange={setShowLeave}
        isPending={leave.isPending}
        isLastMember={isLastMember}
        onConfirm={() => leave.mutate(conversation.id)}
      />
    </>
  );
}
