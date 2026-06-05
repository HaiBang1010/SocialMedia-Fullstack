import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFollow } from '@/features/users/hooks/useFollow';
import { useUnfollow } from '@/features/users/hooks/useUnfollow';
import { Button } from '@/components/ui/button';

interface FollowButtonProps {
  username: string;
  // Current relationship from the loaded profile. Only render this button for a
  // logged-in, non-self viewer (where ProfileUser.isFollowing is a boolean).
  isFollowing: boolean;
}

// Smart follow/unfollow toggle. Not following → "Follow" (coral). Following →
// "Following" (outline); hovering it reveals "Unfollow" (destructive) so the
// destructive action is explicit. Disabled while a mutation is in flight.
export default function FollowButton({ username, isFollowing }: FollowButtonProps) {
  const [hovered, setHovered] = useState(false);
  const follow = useFollow(username);
  const unfollow = useUnfollow(username);
  const pending = follow.isPending || unfollow.isPending;

  if (isFollowing) {
    return (
      <Button
        variant={hovered ? 'destructive' : 'outline'}
        size="sm"
        disabled={pending}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => unfollow.mutate()}
      >
        {pending && <Loader2 className="animate-spin" />}
        {hovered ? 'Unfollow' : 'Following'}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      disabled={pending}
      onClick={() => follow.mutate()}
    >
      {pending && <Loader2 className="animate-spin" />}
      Follow
    </Button>
  );
}
