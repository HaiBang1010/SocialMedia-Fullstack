import { useLikeMutation } from './likeMutation';

// Like a post (POST /posts/:id/like) with optimistic update + rollback.
export function useLikePost(postId: string) {
  return useLikeMutation(postId, 'like');
}
