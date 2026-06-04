import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ACCEPT_ATTR,
  getImageDimensions,
  validateMediaFile,
  type ImageDimensions,
} from '@/lib/image';

interface SelectStageProps {
  onSelect: (file: File, dimensions: ImageDimensions) => void;
}

// Step 1 — pick / drop a file. Validates against the backend contract (5 MIME,
// 10MB) and measures dimensions BEFORE handing off, so an invalid file never
// reaches the crop step or costs a presign call.
export default function SelectStage({ onSelect }: SelectStageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateMediaFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      const dimensions = await getImageDimensions(file);
      onSelect(file, dimensions);
    } catch {
      setError('Could not read this image. Try a different file.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-4 rounded-xl border-2 border-dashed py-16 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <ImagePlus className="size-12 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium">Drag a photo here</p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, GIF, or AVIF · up to 10MB
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()}>
          Select from device
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
