import { useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerOverlayProps {
  onCommit: (emoji: string) => void;
  onCancel: () => void;
}

// Inline emoji-picker overlay (same hand-rolled approach as AddTextOverlay — no nested
// Radix Dialog). Dimmed backdrop; clicking outside the picker or pressing ESC cancels.
export default function EmojiPickerOverlay({ onCommit, onCancel }: EmojiPickerOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Picker
          data={data}
          theme="dark"
          previewPosition="none"
          onEmojiSelect={(emoji: { native: string }) => onCommit(emoji.native)}
        />
      </div>
    </div>
  );
}
