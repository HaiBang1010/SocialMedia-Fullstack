import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from '@/api';
import { removeConversationFromList } from '@/lib/conversationCache';
import { notifyError, notifySuccess } from '@/lib/toast';

// Leave a group. On success drop it from the list cache + evict its detail/messages caches, then
// navigate away from the (now inaccessible / deleted) thread. Server handles last-member deletion;
// socket `conversation:member-left` updates the remaining members.
export function useLeaveConversation() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, string>({
    mutationFn: (conversationId) => conversationsApi.leave(conversationId),
    onSuccess: (_data, conversationId) => {
      removeConversationFromList(qc, conversationId);
      navigate('/messages');
      notifySuccess('You left the group');
    },
    onError: (err) => notifyError(err, 'Could not leave the group'),
  });
}
