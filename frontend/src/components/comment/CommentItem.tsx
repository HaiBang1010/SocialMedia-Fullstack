import type { Comment } from '@/types/api';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';

interface CommentItemProps {
  comment: Comment;
}

// A single flat comment. Optimistic (not-yet-confirmed) comments carry a
// `temp-` id and render dimmed until the server replaces them.
export default function CommentItem({ comment }: CommentItemProps) {
  const pending = comment.id.startsWith('temp-');

  return (
    <div className={cn('flex gap-3', pending && 'opacity-50')}>
      <Avatar user={comment.author} size="sm" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">@{comment.author.username}</span>{' '}
        <span className="break-words whitespace-pre-line">{comment.content}</span>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatRelativeTime(comment.createdAt)}
        </div>
      </div>
    </div>
  );
}
