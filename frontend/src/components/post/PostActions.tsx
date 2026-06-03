import { Bookmark, MessageCircle, Send } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import LikeButton from './LikeButton';

interface PostActionsProps {
  postId: string;
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  // Feed → navigate to the post; detail → focus the comment input.
  onComment?: () => void;
}

// Action row under a post: like + count, comment + count, share, and save.
// Share and save are disabled placeholders for now (wired in a later phase).
export default function PostActions({
  postId,
  isLiked,
  likesCount,
  commentsCount,
  onComment,
}: PostActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <LikeButton postId={postId} isLiked={isLiked} count={likesCount} />
        <button
          type="button"
          onClick={onComment}
          aria-label="Comments"
          className="flex items-center gap-1.5 text-foreground transition-transform hover:text-muted-foreground active:scale-90"
        >
          <MessageCircle className="size-6" />
          <span className="text-sm font-semibold tabular-nums">
            {formatNumber(commentsCount)}
          </span>
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Share"
          className="cursor-not-allowed text-muted-foreground opacity-60"
        >
          <Send className="size-6" />
        </button>
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="Save"
        className="cursor-not-allowed text-muted-foreground opacity-60"
      >
        <Bookmark className="size-6" />
      </button>
    </div>
  );
}
