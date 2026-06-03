import { useLikeMutation } from './likeMutation';

// Unlike a post (DELETE /posts/:id/like) with optimistic update + rollback.
export function useUnlikePost(postId: string) {
  return useLikeMutation(postId, 'unlike');
}
