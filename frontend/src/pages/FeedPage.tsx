import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed } from '@/features/feed/hooks/useFeed';
import { useUserProfile } from '@/features/users/hooks/useUserProfile';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';
import PostCard from '@/components/post/PostCard';
import StoryBar from '@/components/story/StoryBar';
import Spinner from '@/components/common/Spinner';
import ErrorState from '@/components/common/ErrorState';
import EmptyFeedSuggestions from '@/components/users/EmptyFeedSuggestions';
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
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  // followingCount gates onboarding (Q1, Option 1): a brand-new user (0 follows) sees the suggested
  // grid + Done first; once they follow ≥1 and tap Done, they enter the mixed feed.
  const { data: profile } = useUserProfile(me?.username ?? '');
  const [onboardingDone, setOnboardingDone] = useState(false);
  const showOnboarding = profile?.followingCount === 0 && !onboardingDone;

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

  const handleOnboardingDone = () => {
    setOnboardingDone(true);
    qc.invalidateQueries({ queryKey: queryKeys.feed() }); // load the feed with the new follows
    if (me) qc.invalidateQueries({ queryKey: queryKeys.user(me.username) });
  };

  // Onboarding gate — render the suggestion grid instead of the feed for 0-follow users.
  if (showOnboarding) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <EmptyFeedSuggestions onboarding onDone={handleOnboardingDone} />
      </div>
    );
  }

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
          <EmptyFeedSuggestions />
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
