import { create } from 'zustand';

// Controls the global story-composer modal. Ephemeral UI state, no persist.
// The "Your story" tile in StoryBar calls open(); AppLayout renders a single
// <StoryComposer/> bound to isOpen. Mirrors composerStore (post composer).
interface StoryComposerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useStoryComposerStore = create<StoryComposerState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
