import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeed } from '@/features/feed/hooks/useFeed';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import PostCard from '@/components/post/PostCard';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Static placeholders — real stories arrive in Phase 4 (kept from Phase 1C).
const STORIES = [
  'mayac',
  'leop',
  'avar',
  'noahk',
  'sarad',
  'theoq',
  'emmaw',
  'liamb',
  'olivs',
  'noahf',
  'miac',
];

function StoryBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Recompute which arrows are usable from the current scroll position.
  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    // -1 tolerance for sub-pixel rounding at the end of the track.
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Initialise on mount — handles the "fits without scrolling" case (both hidden).
  useEffect(() => {
    updateArrows();
  }, []);

  // Measure a real item at runtime so a click lands on whole-item boundaries
  // (responsive-safe — no hardcoded pixel step that drifts when widths change).
  const scroll = (dir: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;

    const firstItem = container.querySelector('[data-story-item]') as HTMLElement | null;
    if (!firstItem) return;

    const itemWidth = firstItem.offsetWidth;
    const gap = parseFloat(getComputedStyle(container).gap) || 0;
    const step = (itemWidth + gap) * 3; // scroll 3 items per click

    container.scrollBy({
      left: dir === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const arrowBase =
    'absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-md transition-opacity duration-200 md:flex';

  return (
    <div className="group relative border-b pb-4">
      {/* Arrows: desktop-only, fade in on hover, hidden when that direction is exhausted. */}
      <button
        type="button"
        aria-label="Scroll stories left"
        onClick={() => scroll('left')}
        className={cn(
          arrowBase,
          'left-2',
          canScrollLeft
            ? 'opacity-0 group-hover:opacity-100'
            : 'pointer-events-none opacity-0',
        )}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll stories right"
        onClick={() => scroll('right')}
        className={cn(
          arrowBase,
          'right-2',
          canScrollRight
            ? 'opacity-0 group-hover:opacity-100'
            : 'pointer-events-none opacity-0',
        )}
      >
        <ChevronRight className="size-5" />
      </button>

      {/* gap-8 fits exactly 6 stories within the max-w-xl feed width. */}
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="scrollbar-hide flex gap-6.5 overflow-x-auto"
      >
        {/* Your story */}
        <button
          type="button"
          data-story-item
          disabled
          aria-disabled="true"
          className="flex shrink-0 cursor-not-allowed flex-col items-center gap-1.5 opacity-80"
        >
          <span className="flex size-17 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 text-muted-foreground">
            <Plus className="size-6" />
          </span>
          <span className="max-w-16 truncate text-xs text-muted-foreground">
            Your story
          </span>
        </button>

        {STORIES.map((username) => (
          <div
            key={username}
            data-story-item
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="rounded-full bg-gradient-to-tr from-primary to-[oklch(0.7_0.17_80)] p-[2px]">
              <span className="flex size-16 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground">
                {username.slice(0, 2).toUpperCase()}
              </span>
            </span>
            <span className="max-w-16 truncate text-xs">{username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Loading placeholder shaped like the post cards it replaces.
function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

  const sentinelRef = useRef<HTMLDivElement>(null);
  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <StoryBar />

      <div className="mt-6">
        {isLoading ? (
          <FeedSkeleton />
        ) : isError ? (
          <ErrorState
            message="Failed to load your feed."
            onRetry={() => refetch()}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Your feed is empty"
            description="Follow people to see their posts here."
            action={
              <Button variant="outline" size="sm" disabled>
                Find people
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={sentinelRef} aria-hidden="true" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
