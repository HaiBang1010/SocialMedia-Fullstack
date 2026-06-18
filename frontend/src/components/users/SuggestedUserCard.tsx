import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { useFollowSuggested } from '@/features/users/hooks/useFollowSuggested';
import type { PublicUser } from '@/types/api';

interface SuggestedUserCardProps {
  user: PublicUser;
  // compact = horizontal row (right rail); otherwise a vertical card for the empty-feed grid.
  compact?: boolean;
  // Fired after a successful follow (onboarding tracks how many you've followed).
  onFollowed?: () => void;
}

// A suggested account with a Follow action. Suggestions are always not-yet-followed, so the button
// is always "Follow"; following removes the card (useFollowSuggested optimistic remove).
export default function SuggestedUserCard({ user, compact, onFollowed }: SuggestedUserCardProps) {
  const follow = useFollowSuggested();
  const onFollow = () => follow.mutate(user.username, { onSuccess: () => onFollowed?.() });

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Link to={`/users/${user.username}`} className="shrink-0">
          <Avatar user={user} size="md" />
        </Link>
        <Link to={`/users/${user.username}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
        </Link>
        <button
          type="button"
          onClick={onFollow}
          disabled={follow.isPending}
          className="shrink-0 text-xs font-semibold text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {follow.isPending ? '…' : 'Follow'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center">
      <Link to={`/users/${user.username}`}>
        <Avatar user={user} size="lg" />
      </Link>
      <Link to={`/users/${user.username}`} className="min-w-0 max-w-full">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
      </Link>
      <Button size="sm" onClick={onFollow} disabled={follow.isPending} className="mt-1 w-full">
        {follow.isPending && <Loader2 className="animate-spin" />}
        Follow
      </Button>
    </div>
  );
}
