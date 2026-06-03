import { useNavigate, useParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import PostDetailView from './PostDetailView';

// Desktop overlay for a post, rendered on top of the feed via the
// background-location route. Closing returns to the post the user came from.
export default function PostDetailModal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent showClose className="max-w-4xl gap-0 p-0">
        {/* Required for Radix a11y; the post header already shows the author. */}
        <DialogTitle className="sr-only">Post</DialogTitle>
        <PostDetailView postId={id} />
      </DialogContent>
    </Dialog>
  );
}
