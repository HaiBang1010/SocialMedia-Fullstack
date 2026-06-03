import { useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/features/comments/hooks/useComments';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import CommentItem from './CommentItem';

interface CommentListProps {
  postId: string;
}

// Newest-first comment list with cursor-based infinite scroll.
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

  const sentinelRef = useRef<HTMLDivElement>(null);
  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

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
        <CommentItem key={comment.id} comment={comment} />
      ))}
      <div ref={sentinelRef} aria-hidden="true" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Spinner className="size-4" />
        </div>
      )}
    </div>
  );
}
