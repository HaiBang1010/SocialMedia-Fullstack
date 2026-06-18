import { useState } from 'react';
import { useSuggestedUsers } from '@/features/users/hooks/useSuggestedUsers';
import SuggestedUserCard from '@/components/users/SuggestedUserCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4';

interface EmptyFeedSuggestionsProps {
  // Onboarding mode (new user, 0 follows): shows a "Done" button to enter the feed once they've
  // followed at least one account. Without it, this is just a suggestions grid (rare empty fallback).
  onboarding?: boolean;
  onDone?: () => void;
}

// A grid of accounts to follow. As an onboarding gate (new users) it surfaces a Done button after
// the first follow; as a plain empty-feed fallback it's just the grid. Reuses the shared
// suggested-users query so follows reflect across surfaces.
export default function EmptyFeedSuggestions({ onboarding, onDone }: EmptyFeedSuggestionsProps) {
  const { data: users, isLoading } = useSuggestedUsers();
  const [followedCount, setFollowedCount] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-heading text-lg font-semibold">Suggested for you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {onboarding
            ? 'Follow a few accounts to get started, then tap Done.'
            : 'Follow accounts to start filling your feed.'}
        </p>
      </div>

      {isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-xl border p-4">
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1 h-7 w-full" />
            </div>
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No suggestions yet.</p>
      ) : (
        <div className={GRID}>
          {users.map((u) => (
            <SuggestedUserCard
              key={u.id}
              user={u}
              onFollowed={() => setFollowedCount((c) => c + 1)}
            />
          ))}
        </div>
      )}

      {onboarding && followedCount >= 1 && (
        <div className="flex justify-center pt-2">
          <Button size="lg" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
