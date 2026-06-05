import { useFollowMutation } from './followMutation';

// Unfollow a user (DELETE /users/:username/follow) with optimistic update + rollback.
export function useUnfollow(username: string) {
  return useFollowMutation(username, 'unfollow');
}
