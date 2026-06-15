import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { useTypingEmit } from '@/features/messaging/hooks/useTypingEmit';
import { prepareAttachment, setPendingAttachments, validateAttachment } from '@/features/messaging/mediaUpload';
import { ACCEPT_ATTR } from '@/lib/image';
import { isVideoFile } from '@/lib/video';

interface MessageInputProps {
  conversationId: string;
}

const MAX_HEIGHT = 128; // px — textarea grows up to ~5 rows then scrolls
const MAX_MEDIA = 10; // mirrors backend MAX_MESSAGE_MEDIA (Phase 5.4a, D-Q1)

// A picked-but-not-yet-sent attachment + its object URL for the preview strip.
interface Selected {
  id: string;
  file: File;
  url: string;
  isVideo: boolean;
}

export default function MessageInput({ conversationId }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState<Selected[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSendMessage(conversationId);
  const { start: startTyping, stop: stopTyping } = useTypingEmit(conversationId);

  // Revoke any leftover preview URLs on unmount (latest set via a ref so the effect runs once).
  const selectedRef = useRef<Selected[]>([]);
  selectedRef.current = selected;
  useEffect(() => () => selectedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const resize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    if (picked.length === 0) return;

    setError(null);
    const next: Selected[] = [];
    let rejected: string | null = null;
    for (const file of picked) {
      if (selected.length + next.length >= MAX_MEDIA) {
        rejected = `You can attach up to ${MAX_MEDIA} files.`;
        break;
      }
      const err = validateAttachment(file);
      if (err) {
        rejected = err;
        continue;
      }
      next.push({
        id: `sel-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
        isVideo: isVideoFile(file),
      });
    }
    if (rejected) setError(rejected);
    if (next.length) setSelected((prev) => [...prev, ...next]);
  };

  const removeSelected = (id: string) => {
    setError(null); // user acted on the limit/validation warning → dismiss it
    setSelected((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((s) => s.id !== id);
    });
  };

  const send = async () => {
    const content = value.trim();
    if ((!content && selected.length === 0) || isPending || preparing) return;

    stopTyping();
    const tempId = `temp-${crypto.randomUUID()}`;

    if (selected.length > 0) {
      setPreparing(true);
      try {
        const attachments = await Promise.all(selected.map((s) => prepareAttachment(s.file)));
        setPendingAttachments(tempId, attachments);
      } catch {
        setError('Could not prepare one of the attachments.');
        setPreparing(false);
        return;
      }
      setPreparing(false);
    }

    mutate({ tempId, content: content || undefined });

    // Clear the composer (the optimistic bubble now owns the preview).
    selected.forEach((s) => URL.revokeObjectURL(s.url));
    setSelected([]);
    setValue('');
    setError(null);
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  const canSend = (!!value.trim() || selected.length > 0) && !isPending && !preparing;

  return (
    <form onSubmit={onSubmit} className="flex shrink-0 flex-col gap-2 border-t p-3">
      {selected.length > 0 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {selected.map((s) => (
            <div key={s.id} className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
              {s.isVideo ? (
                <video src={s.url} muted className="size-full object-cover" />
              ) : (
                <img src={s.url} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeSelected(s.id)}
                aria-label="Remove attachment"
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-1 text-xs text-destructive">{error}</p>}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={`${ACCEPT_ATTR},video/mp4`}
          multiple
          hidden
          onChange={onFilesPicked}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending || preparing || selected.length >= MAX_MEDIA}
          aria-label="Attach photos or videos"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="size-5" />
        </button>

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
            startTyping();
          }}
          onKeyDown={onKeyDown}
          onBlur={stopTyping}
          rows={1}
          placeholder="Message…"
          aria-label="Message"
          className="scrollbar-hide max-h-32 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {preparing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </form>
  );
}
