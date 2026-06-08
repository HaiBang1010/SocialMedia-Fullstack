import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserStories } from '@/features/stories/hooks/useUserStories';
import { useViewStory } from '@/features/stories/hooks/useViewStory';
import { useDeleteStory } from '@/features/stories/hooks/useDeleteStory';
import { formatRelativeTime } from '@/lib/format';

// Auto-advance: images show for 5s, videos for their clip length (with onEnded as
// a backup). Detailed timed progress bars + gestures (hold-pause, swipe) arrive
// in Phase 4.2; this is the minimal viewer.
const IMAGE_DURATION_MS = 5000;

// Full-screen story viewer — a single instance mounted in AppLayout, driven by
// storyViewerStore. Hand-rolled fixed overlay (not Radix Dialog) so Phase 4.2 can
// add gestures without fighting a focus trap; we lock body scroll + handle ESC here.
export default function StoryViewer() {
  const isOpen = useStoryViewerStore((s) => s.isOpen);
  const username = useStoryViewerStore((s) => s.username);
  const close = useStoryViewerStore((s) => s.close);
  const me = useAuthStore((s) => s.user);

  const { data: stories, isLoading } = useUserStories(username, isOpen);
  const { view } = useViewStory();
  const { remove } = useDeleteStory();

  const [index, setIndex] = useState(0);
  const startedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const total = stories?.length ?? 0;
  const current = stories?.[index];

  const goNext = () => {
    if (index + 1 < total) setIndex(index + 1);
    else close();
  };
  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  // Reset cursor when switching users / closing.
  useEffect(() => {
    startedRef.current = false;
    setIndex(0);
  }, [username]);

  // Start at the first unseen story once they load (fallback to the first).
  useEffect(() => {
    if (!startedRef.current && stories && stories.length > 0) {
      const firstUnseen = stories.findIndex((s) => !s.isViewedByMe);
      setIndex(firstUnseen === -1 ? 0 : firstUnseen);
      startedRef.current = true;
    }
  }, [stories]);

  // Nothing active for this user → close.
  useEffect(() => {
    if (isOpen && stories && stories.length === 0) close();
  }, [isOpen, stories, close]);

  // Body scroll lock + ESC while open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  // Mark the current story seen (idempotent). Skipped for already-seen stories so
  // the effect doesn't re-fire after the optimistic cache flip.
  useEffect(() => {
    if (isOpen && current && username && !current.isViewedByMe) {
      view({ storyId: current.id, username });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current?.id]);

  // Auto-advance timer keyed on the current story.
  useEffect(() => {
    if (!isOpen || !current) return;
    const ms =
      current.mediaType === 'VIDEO'
        ? current.duration
          ? current.duration * 1000
          : 15000
        : IMAGE_DURATION_MS;
    const t = setTimeout(() => {
      if (index + 1 < total) setIndex(index + 1);
      else close();
    }, ms + 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current?.id, index, total]);

  // Try to play videos with sound (opening the viewer was a user gesture); fall
  // back to muted autoplay if the browser blocks it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, [current?.id]);

  if (!isOpen) return null;

  const isOwner = !!me && !!current && me.id === current.authorId;

  const handleDelete = () => {
    if (!current || !username) return;
    const wasLast = total <= 1;
    remove({ storyId: current.id, username });
    if (wasLast) {
      close();
    } else if (index >= total - 1) {
      // Deleting the last story: step back so we land on the new last item.
      setIndex(total - 2);
    }
    // Otherwise the next story shifts into the current index automatically.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute top-4 right-4 z-30 grid size-9 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
      >
        <X className="size-5" />
      </button>

      <div className="relative h-full w-full max-w-md overflow-hidden bg-neutral-900">
        {isLoading || !current ? (
          <div className="grid size-full place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {current.mediaType === 'VIDEO' ? (
              <video
                key={current.id}
                ref={videoRef}
                src={current.mediaUrl}
                poster={current.thumbnailUrl ?? undefined}
                playsInline
                autoPlay
                onEnded={goNext}
                className="absolute inset-0 size-full object-contain"
              />
            ) : (
              <img
                src={current.mediaUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            )}

            {/* Position indicators (timed fill animation arrives Phase 4.2). */}
            <div className="absolute inset-x-2 top-2 z-20 flex gap-1">
              {stories!.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    i <= index ? 'bg-white' : 'bg-white/35',
                  )}
                />
              ))}
            </div>

            {/* Header */}
            <div className="absolute inset-x-3 top-5 z-20 flex items-center gap-2 text-white">
              <Avatar user={current.author} size="sm" className="ring-2 ring-white/70" />
              <span className="text-sm font-medium">{current.author.username}</span>
              <span className="text-xs text-white/70">
                {formatRelativeTime(current.createdAt)}
              </span>
              {isOwner && (
                <button
                  type="button"
                  aria-label="Delete story"
                  onClick={handleDelete}
                  className="ml-auto grid size-8 place-items-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/55"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            {/* Tap zones: left third = previous, right two-thirds = next. */}
            <button
              type="button"
              aria-label="Previous story"
              onClick={goPrev}
              className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default focus:outline-none"
            />
            <button
              type="button"
              aria-label="Next story"
              onClick={goNext}
              className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-default focus:outline-none"
            />
          </>
        )}
      </div>
    </div>
  );
}
