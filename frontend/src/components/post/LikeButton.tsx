import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { useLikePost } from '@/features/likes/hooks/useLikePost';
import { useUnlikePost } from '@/features/likes/hooks/useUnlikePost';

interface LikeButtonProps {
  postId: string;
  isLiked: boolean;
  count: number;
  // Tailwind size class for the heart icon (defaults to size-6).
  iconClassName?: string;
  className?: string;
}

// Heart toggle with its like count beside it. Reads liked-state/count from the
// cached post (passed in), so the optimistic mutation re-renders both in sync.
// Fires the optimistic like/unlike and ignores clicks while one is in flight.
export default function LikeButton({
  postId,
  isLiked,
  count,
  iconClassName = 'size-6',
  className,
}: LikeButtonProps) {
  const like = useLikePost(postId);
  const unlike = useUnlikePost(postId);
  const pending = like.isPending || unlike.isPending;

  const handleClick = () => {
    if (pending) return;
    if (isLiked) unlike.mutate();
    else like.mutate();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isLiked}
      aria-label={isLiked ? 'Unlike' : 'Like'}
      className={cn(
        'group/like flex items-center gap-1.5 transition-transform active:scale-90',
        className,
      )}
    >
      <Heart
        className={cn(
          iconClassName,
          isLiked
            ? 'fill-current text-primary'
            : 'text-foreground group-hover/like:text-muted-foreground',
        )}
      />
      <span className="text-sm font-semibold tabular-nums">
        {formatNumber(count)}
      </span>
    </button>
  );
}
