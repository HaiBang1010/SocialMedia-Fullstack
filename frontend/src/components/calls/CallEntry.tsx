import { Phone, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { callStatusLabel } from '@/lib/call';
import type { Message } from '@/types/api';

interface CallEntryProps {
  message: Message;
}

// Phase 6 — a CALL message rendered in the thread: a DISPLAY-ONLY history record (icon + status
// label + duration: "Audio call · 5:23", "Missed call" in red, "Call declined"). Calls are started
// ONLY from the header CallButtons — there is no call-back on click (per user decision).
export default function CallEntry({ message }: CallEntryProps) {
  const call = message.call;
  if (!call) return null;

  const { text, missed } = callStatusLabel(call);
  const Icon = call.type === 'VIDEO' ? Video : Phone;

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border px-3 py-2">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          missed ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className={cn('text-sm font-medium', missed && 'text-destructive')}>{text}</span>
    </div>
  );
}
