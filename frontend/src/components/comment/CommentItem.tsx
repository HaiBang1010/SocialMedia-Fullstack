import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Comment } from '@/types/api';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import { parseMentions } from '@/lib/parseMentions';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteComment } from '@/features/comments/hooks/useDeleteComment';
import Avatar from '@/components/common/Avatar';
import RepliesList from './RepliesList';
import CommentDeleteConfirmDialog from './CommentDeleteConfirmDialog';

// Which root comment an inline reply form is currently attached to (lifted to CommentList).
export interface ReplyTarget {
  rootCommentId: string;
  replyToUsername: string;
}

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean; // true when rendered inside a RepliesList (no nested replies/toggle)
  replyingTo?: ReplyTarget | null;
  onReplyClick?: (target: ReplyTarget) => void;
  onCancelReply?: () => void;
}

// A single comment. Root comments can expand their replies and host an inline reply
// form; replies (isReply) render flat one level deep with no further nesting.
// Optimistic (not-yet-confirmed) comments carry a `temp-` id and render dimmed.
export default function CommentItem({
  comment,
  isReply = false,
  replyingTo,
  onReplyClick,
  onCancelReply,
}: CommentItemProps) {
  const me = useAuthStore((s) => s.user);
  const del = useDeleteComment();
  const [showReplies, setShowReplies] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pending = comment.id.startsWith('temp-');
  const isMine = me?.id === comment.author.id;
  const hasReplies = !isReply && comment.repliesCount > 0;
  const authorTo = `/users/${comment.author.username}`;

  const handleReply = () => {
    if (pending) return;
    if (isReply) {
      // Replies flatten to their root; attach the form to the root, mention this author.
      onReplyClick?.({
        rootCommentId: comment.parentId!,
        replyToUsername: comment.author.username,
      });
    } else {
      setShowReplies(true); // auto-expand so the inline form has a home (even with 0 replies)
      onReplyClick?.({ rootCommentId: comment.id, replyToUsername: comment.author.username });
    }
  };

  const handleDeleteClick = () => {
    if (!isReply && comment.repliesCount > 0) {
      setConfirmOpen(true); // cascade-delete → confirm
    } else {
      del.mutate({
        commentId: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
        repliesCount: comment.repliesCount,
      });
    }
  };

  const handleHideReplies = () => {
    setShowReplies(false);
    if (replyingTo?.rootCommentId === comment.id) onCancelReply?.();
  };

  // Clearing the inline form: drop the target, and collapse a thread that's still empty.
  const handleReplyClose = () => {
    onCancelReply?.();
    if (comment.repliesCount === 0) setShowReplies(false);
  };

  return (
    <div className={cn('flex gap-3', pending && 'opacity-50')}>
      <Link to={authorTo}>
        <Avatar user={comment.author} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <Link to={authorTo} className="font-semibold hover:underline">
          @{comment.author.username}
        </Link>{' '}
        <span className="break-words whitespace-pre-line">{parseMentions(comment.content)}</span>

        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {!pending && (
            <button type="button" onClick={handleReply} className="font-medium hover:text-foreground">
              Reply
            </button>
          )}
          {isMine && !pending && (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={del.isPending}
              className="font-medium hover:text-destructive disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>

        {hasReplies && (
          <button
            type="button"
            onClick={() => (showReplies ? handleHideReplies() : setShowReplies(true))}
            className="mt-1 block text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showReplies
              ? 'Hide replies'
              : `View ${formatNumber(comment.repliesCount)} ${comment.repliesCount === 1 ? 'reply' : 'replies'}`}
          </button>
        )}

        {!isReply && showReplies && (
          <RepliesList
            commentId={comment.id}
            postId={comment.postId}
            replyingTo={replyingTo}
            onReplyClick={onReplyClick}
            onReplyClose={handleReplyClose}
          />
        )}
      </div>

      {confirmOpen && (
        <CommentDeleteConfirmDialog
          comment={comment}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      )}
    </div>
  );
}
