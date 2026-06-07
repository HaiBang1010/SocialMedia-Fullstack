import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateComment } from '@/features/comments/hooks/useCreateComment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Shared so the post-detail comment icon can focus the MAIN input by id (the shadcn
// Input is a plain function component and doesn't forward a ref under React 18).
// Inline reply forms must NOT reuse this id — they pass `autoFocus` instead, so a
// post detail never has two elements with the same id.
export const COMMENT_INPUT_ID = 'comment-input';

interface CommentFormProps {
  postId: string;
  parentId?: string; // reply mode: attach to this root comment id
  parentUsername?: string; // prefill "@username " + show a "Replying to" chip
  onClose?: () => void; // reply mode: called after a successful send OR on cancel
  inputId?: string; // main form only (focus-by-id); omit for reply forms
  autoFocus?: boolean;
}

// Comment / reply composer. Optimistic via useCreateComment; clears only on a
// confirmed success so the text survives a failed submit.
export default function CommentForm({
  postId,
  parentId,
  parentUsername,
  onClose,
  inputId,
  autoFocus,
}: CommentFormProps) {
  const isReply = Boolean(parentId);
  const [content, setContent] = useState(() => (parentUsername ? `@${parentUsername} ` : ''));
  const createComment = useCreateComment(postId);

  // Re-prefill when the reply target changes (the inline form is reused per root).
  useEffect(() => {
    if (parentUsername) setContent(`@${parentUsername} `);
  }, [parentId, parentUsername]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || createComment.isPending) return;
    createComment.mutate(
      { content: trimmed, parentId },
      {
        onSuccess: () => {
          setContent('');
          onClose?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      {isReply && parentUsername && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            Replying to{' '}
            <span className="font-medium text-foreground">@{parentUsername}</span>
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-full p-0.5 hover:bg-muted hover:text-foreground"
              aria-label="Cancel reply"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isReply ? 'Add a reply…' : 'Add a comment…'}
          maxLength={2200}
          disabled={createComment.isPending}
          autoFocus={autoFocus}
          className="flex-1"
          aria-label={isReply ? 'Add a reply' : 'Add a comment'}
        />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={!content.trim() || createComment.isPending}
        >
          {isReply ? 'Reply' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
