import { useFollowMutation } from './followMutation';

// Follow a user (POST /users/:username/follow) with optimistic update + rollback.
export function useFollow(username: string) {
  return useFollowMutation(username, 'follow');
}
