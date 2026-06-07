import { useReplies } from '@/features/comments/hooks/useReplies';
import Spinner from '@/components/common/Spinner';
import ErrorState from '@/components/common/ErrorState';
import CommentItem, { type ReplyTarget } from './CommentItem';
import CommentForm from './CommentForm';

interface RepliesListProps {
  commentId: string; // the root comment whose replies these are
  postId: string;
  replyingTo?: ReplyTarget | null;
  onReplyClick?: (target: ReplyTarget) => void;
  onReplyClose?: () => void; // clear the reply target (after send / cancel)
}

// Lazily-loaded, indented replies of a root comment (chronological), plus the inline
// reply composer at the bottom when this thread is the active reply target.
export default function RepliesList({
  commentId,
  postId,
  replyingTo,
  onReplyClick,
  onReplyClose,
}: RepliesListProps) {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useReplies(commentId);

  const replies = data?.pages.flatMap((page) => page.comments) ?? [];
  const showForm = replyingTo?.rootCommentId === commentId;

  return (
    <div className="mt-3 flex flex-col gap-3 border-l border-border pl-3">
      {isLoading ? (
        <div className="flex py-2">
          <Spinner className="size-4" />
        </div>
      ) : isError ? (
        <ErrorState message="Failed to load replies." onRetry={() => refetch()} className="py-2" />
      ) : (
        <>
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              replyingTo={replyingTo}
              onReplyClick={onReplyClick}
              onCancelReply={onReplyClose}
            />
          ))}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="self-start text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'View more replies'}
            </button>
          )}
        </>
      )}

      {showForm && (
        <CommentForm
          postId={postId}
          parentId={commentId}
          parentUsername={replyingTo!.replyToUsername}
          autoFocus
          onClose={onReplyClose}
        />
      )}
    </div>
  );
}
