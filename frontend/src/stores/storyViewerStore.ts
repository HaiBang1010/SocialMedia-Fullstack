import { create } from 'zustand';

// Controls the full-screen story viewer. Holds which author's stories to show;
// the viewer fetches that user's active stories via useUserStories(username).
// AppLayout renders a single <StoryViewer/> bound to isOpen.
interface StoryViewerState {
  isOpen: boolean;
  username: string | null;
  open: (username: string) => void;
  close: () => void;
}

export const useStoryViewerStore = create<StoryViewerState>()((set) => ({
  isOpen: false,
  username: null,
  open: (username) => set({ isOpen: true, username }),
  close: () => set({ isOpen: false, username: null }),
}));
