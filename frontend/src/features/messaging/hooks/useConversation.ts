import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { getStatus } from '@/lib/apiError';

// One conversation (GET /conversations/:id) — drives the detail header. Enabled only with an id.
export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    queryFn: () => conversationsApi.get(id!),
    enabled: !!id,
    // A 404 (gone / not a participant) shouldn't retry — surface the not-found instantly.
    retry: (count, err) => getStatus(err) !== 404 && count < 1,
  });
}
