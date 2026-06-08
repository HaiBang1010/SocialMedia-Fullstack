import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CROPPABLE_MIME,
  MAX_FILE_BYTES,
  getImageDimensions,
  type ImageDimensions,
} from '@/lib/image';
import { getVideoMetadata, isVideoFile, validateVideoFile } from '@/lib/video';

// Stories take ONE media. Images are CROPPABLE only (JPEG/PNG/WebP) — GIF/AVIF are
// rejected because they can't be force-cropped to 9:16. Video is MP4, ≤50MB, ≤15s.
const MAX_STORY_VIDEO_SECONDS = 15;
const SELECT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].join(',');

interface SelectStoryStageProps {
  onPickImage: (file: File, dimensions: ImageDimensions) => void;
  onPickVideo: (file: File, dimensions: ImageDimensions, duration: number) => void;
}

// Step 1 — pick / drop one media. The chosen file type decides the flow:
// image → crop (9:16), video → preview (poster extraction).
export default function SelectStoryStage({ onPickImage, onPickVideo }: SelectStoryStageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    // ── Video branch: MP4, ≤50MB, ≤15s ──
    if (isVideoFile(file)) {
      const vErr = validateVideoFile(file);
      if (vErr) {
        setError(vErr);
        return;
      }
      try {
        const meta = await getVideoMetadata(file);
        if (meta.duration > MAX_STORY_VIDEO_SECONDS) {
          setError(`Video is too long (max ${MAX_STORY_VIDEO_SECONDS}s for stories).`);
          return;
        }
        setError(null);
        onPickVideo(file, { width: meta.width, height: meta.height }, meta.duration);
      } catch {
        setError('Could not read the video. Try a different file.');
      }
      return;
    }

    // ── Image branch: croppable only ──
    if (!CROPPABLE_MIME.has(file.type)) {
      setError('Unsupported file. Use a JPEG, PNG, or WebP photo, or an MP4 video.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Photo is too large (max 10MB).');
      return;
    }
    try {
      const dimensions = await getImageDimensions(file);
      setError(null);
      onPickImage(file, dimensions);
    } catch {
      setError('Could not read the image. Try a different file.');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-4 rounded-xl border-2 border-dashed py-12 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <ImagePlus className="size-12 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium">Drag a photo or video here</p>
          <p className="text-xs text-muted-foreground">
            One photo (JPEG/PNG/WebP, up to 10MB) or an MP4 video (up to 50MB, max 15s)
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()}>Select from device</Button>
        <input
          ref={inputRef}
          type="file"
          accept={SELECT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
