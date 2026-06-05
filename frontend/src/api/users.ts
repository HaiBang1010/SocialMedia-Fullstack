import { apiClient } from './client';
import type { ProfileResponse, UserResponse } from '@/types/api';

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate?: boolean;
}

export const usersApi = {
  // GET /users/:username → public profile DTO (counts + isFollowing).
  getByUsername: async (username: string): Promise<ProfileResponse> => {
    const { data } = await apiClient.get<ProfileResponse>(`/users/${username}`);
    return data;
  },

  updateMe: async (input: UpdateProfileInput): Promise<UserResponse> => {
    const { data } = await apiClient.patch<UserResponse>('/users/me', input);
    return data;
  },
};
