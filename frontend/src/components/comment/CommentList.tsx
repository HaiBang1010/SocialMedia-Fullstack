import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/features/comments/hooks/useComments';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import CommentItem, { type ReplyTarget } from './CommentItem';

interface CommentListProps {
  postId: string;
}

// Root comments (newest-first) with button-based "View more" pagination. Holds the
// single active reply target so only one inline reply form is open at a time.
export default function CommentList({ postId }: CommentListProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useComments(postId);

  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Failed to load comments."
        onRetry={() => refetch()}
        className="py-8"
      />
    );
  }

  const comments = data?.pages.flatMap((page) => page.comments) ?? [];

  if (comments.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No comments yet"
        description="Be the first to comment."
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          replyingTo={replyingTo}
          onReplyClick={setReplyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      ))}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-start text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'View more comments'}
        </button>
      )}
    </div>
  );
}
