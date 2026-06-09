import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface AddTextOverlayProps {
  onCommit: (text: string) => void;
  onCancel: () => void;
}

// Inline text-entry overlay (NOT a nested Radix Dialog — the composer is already a Dialog,
// and nesting fights the focus trap, same reason the viewer is hand-rolled). Covers the
// editor with a dimmed backdrop + an auto-focused textarea. ESC / Cancel / empty submit
// all cancel. The composer suppresses Radix's ESC-to-close on the edit step so ESC here
// only closes this overlay.
export default function AddTextOverlay({ onCommit, onCancel }: AddTextOverlayProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/70">
      <div className="flex items-center justify-between p-3">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={commit}>Done</Button>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something…"
          rows={3}
          maxLength={200}
          className="w-full max-w-sm resize-none bg-transparent text-center text-3xl font-bold text-white placeholder:text-white/50 focus:outline-none"
        />
      </div>
    </div>
  );
}
