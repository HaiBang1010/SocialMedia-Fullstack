import { useRef } from 'react';
import { Users } from 'lucide-react';
import { useFeed } from '@/features/feed/hooks/useFeed';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import PostCard from '@/components/post/PostCard';
import StoryBar from '@/components/story/StoryBar';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
