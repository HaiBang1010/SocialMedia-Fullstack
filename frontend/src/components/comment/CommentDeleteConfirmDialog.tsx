import { Loader2 } from 'lucide-react';
import { useDeleteComment } from '@/features/comments/hooks/useDeleteComment';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Comment } from '@/types/api';

interface CommentDeleteConfirmDialogProps {
  comment: Comment; // a ROOT comment with replies (deleting it cascades them)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

// Confirmation shown ONLY when deleting a root comment that has replies (the delete
// cascades them). Replies and reply-less roots delete instantly without a dialog.
export default function CommentDeleteConfirmDialog({
  comment,
  open,
  onOpenChange,
  onDeleted,
}: CommentDeleteConfirmDialogProps) {
  const del = useDeleteComment();
  const { repliesCount } = comment;

  const handleOpenChange = (next: boolean) => {
    if (del.isPending) return; // don't dismiss mid-delete
    if (!next) del.reset();
    onOpenChange(next);
  };

  const handleDelete = () => {
    del.mutate(
      {
        commentId: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
        repliesCount,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete comment?</DialogTitle>
          <DialogDescription>
            This also deletes its {repliesCount}{' '}
            {repliesCount === 1 ? 'reply' : 'replies'}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {del.error && (
          <p className="text-sm text-destructive">
            Couldn't delete the comment. Please try again.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={del.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
