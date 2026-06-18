import { useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { mediaApi, uploadToPresignedUrl, usersApi } from '@/api';
import { getCroppedAvatarBlob } from '@/lib/cropAvatar';
import { notifyError, notifySuccess } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { User } from '@/types/api';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB client cap (⊆ backend 10 MB)
const ACCEPT = 'image/jpeg,image/png,image/webp';
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface AvatarUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: User) => void;
}

// Pick → square-crop (react-easy-crop, 1:1) → presign → PUT to MinIO → PATCH /users/me avatarUrl.
// Reuses the Phase-2 presign/upload pattern + Plan-A toast.
export default function AvatarUploadDialog({
  open,
  onOpenChange,
  onSaved,
}: AvatarUploadDialogProps) {
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the preview object URL + reset cropper state. Called on close + before a new pick.
  const resetState = () => {
    setFileSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const close = () => {
    if (uploading) return; // don't close mid-upload
    resetState();
    onOpenChange(false);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!ACCEPTED.has(file.type)) {
      toast.error('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large (max 5MB).');
      return;
    }
    resetState();
    setFileSrc(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!fileSrc || !croppedAreaPixels || uploading) return;
    setUploading(true);
    try {
      const blob = await getCroppedAvatarBlob(fileSrc, croppedAreaPixels);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const presign = await mediaApi.presign({ contentType: 'image/jpeg', size: file.size });
      await uploadToPresignedUrl(presign.uploadUrl, file);
      const { user } = await usersApi.updateMe({ avatarUrl: presign.publicUrl });
      notifySuccess('Photo updated');
      onSaved(user);
      resetState();
      onOpenChange(false);
    } catch (err) {
      notifyError(err, "Couldn't update photo"); // keep the dialog open for a retry
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change profile photo</DialogTitle>
          <DialogDescription>Pick an image and drag / zoom to frame it.</DialogDescription>
        </DialogHeader>

        {fileSrc ? (
          <div className="flex flex-col gap-3">
            <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
              <Cropper
                image={fileSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="w-full accent-primary"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="self-start text-xs text-primary hover:underline"
            >
              Choose a different image
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-muted"
          >
            <Upload className="size-6" />
            <span className="text-sm">Choose a photo</span>
            <span className="text-xs">JPEG, PNG or WebP · up to 5MB</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={onPickFile}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!croppedAreaPixels || uploading}>
            {uploading && <Loader2 className="animate-spin" />}
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
