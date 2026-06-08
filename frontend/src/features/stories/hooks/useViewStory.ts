import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  markStoryViewedInCaches,
  restoreStoryCaches,
  snapshotStoryCaches,
  type StoryCacheSnapshot,
} from '@/lib/storyCache';

interface ViewVars {
  storyId: string;
  username: string; // author's username — which userStories cache to patch
}

// Mark a story viewed (POST /stories/:id/view, idempotent). Optimistically flips
// isViewedByMe + the group's ring flag in both caches; rolls back on error.
export function useViewStory() {
  const qc = useQueryClient();

  const mutation = useMutation<void, Error, ViewVars, StoryCacheSnapshot>({
    mutationFn: ({ storyId }) => storiesApi.view(storyId),

    onMutate: async ({ storyId, username }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.storiesFeed() }),
        qc.cancelQueries({ queryKey: queryKeys.userStories(username) }),
      ]);
      const snapshot = snapshotStoryCaches(qc, username);
      markStoryViewedInCaches(qc, username, storyId);
      return snapshot;
    },

    onError: (_err, _vars, snapshot) => {
      if (snapshot) restoreStoryCaches(qc, snapshot);
    },
  });

  return { view: mutation.mutate, isPending: mutation.isPending };
}
