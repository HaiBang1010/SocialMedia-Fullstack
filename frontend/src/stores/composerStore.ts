import { create } from 'zustand';

// Controls the global post-composer modal. Ephemeral UI state, so no persist /
// middleware. Triggers (Sidebar, BottomNav, Profile empty-state) call `open()`;
// AppLayout renders a single <PostComposerModal/> bound to `isOpen`.
interface ComposerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useComposerStore = create<ComposerState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
