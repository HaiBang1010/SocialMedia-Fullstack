import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PostDetailView from '@/components/post/PostDetailView';

// Standalone post page: mobile navigation, a shared/direct URL, or a refresh
// (where the modal's background-location state is gone).
export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <div className="overflow-hidden rounded-xl border bg-card">
        <PostDetailView postId={id} />
      </div>
    </div>
  );
}
