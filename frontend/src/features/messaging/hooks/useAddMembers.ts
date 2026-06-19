import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { notifyError, notifySuccess } from '@/lib/toast';
import type { AddMembersInput, Conversation } from '@/types/api';

// Add members to a group. The server returns the updated conversation → seed the detail cache,
// then refresh the list (new participant may change the auto-derived name / preview). Socket
// `conversation:member-added` separately refreshes the new members' own lists.
export function useAddMembers(conversationId: string) {
  const qc = useQueryClient();

  return useMutation<Conversation, Error, AddMembersInput>({
    mutationFn: (input) => conversationsApi.addMembers(conversationId, input),
    onSuccess: (convo) => {
      qc.setQueryData(queryKeys.conversation(conversationId), convo);
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      notifySuccess('Members added');
    },
    onError: (err) => notifyError(err, 'Could not add members'),
  });
}
