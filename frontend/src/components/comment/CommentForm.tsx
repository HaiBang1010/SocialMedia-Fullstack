import { useState, type FormEvent } from 'react';
import { useCreateComment } from '@/features/comments/hooks/useCreateComment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Shared so the post-detail comment icon can focus this input by id (the shadcn
// Input is a plain function component and doesn't forward a ref under React 18).
export const COMMENT_INPUT_ID = 'comment-input';

interface CommentFormProps {
  postId: string;
}

// Comment composer. Optimistically appends via useCreateComment; clears only on
// a confirmed success so the text survives a failed submit.
export default function CommentForm({ postId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const createComment = useCreateComment(postId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || createComment.isPending) return;
    createComment.mutate(trimmed, {
      onSuccess: () => setContent(''),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        id={COMMENT_INPUT_ID}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment…"
        maxLength={2200}
        disabled={createComment.isPending}
        className="flex-1"
        aria-label="Add a comment"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={!content.trim() || createComment.isPending}
      >
        Post
      </Button>
    </form>
  );
}
