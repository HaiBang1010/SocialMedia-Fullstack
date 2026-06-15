import { create } from 'zustand';
import type { MessageMedia } from '@/types/api';

// Controls the full-screen message-media lightbox (Phase 5.4a). A single <MediaLightbox/> is
// mounted in AppLayout, opened from a MediaCell with that message's media[] + the tapped index.
interface MediaLightboxState {
  isOpen: boolean;
  media: MessageMedia[];
  index: number;
  open: (media: MessageMedia[], index: number) => void;
  setIndex: (index: number) => void;
  close: () => void;
}

export const useMediaLightboxStore = create<MediaLightboxState>()((set) => ({
  isOpen: false,
  media: [],
  index: 0,
  open: (media, index) => set({ isOpen: true, media, index }),
  setIndex: (index) => set({ index }),
  close: () => set({ isOpen: false, media: [], index: 0 }),
}));
