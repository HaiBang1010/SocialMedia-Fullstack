import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useComposerStore } from '@/stores/composerStore';
import { useCreatePost } from '@/features/posts/hooks/useCreatePost';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { PASSTHROUGH_MIME, type ImageDimensions } from '@/lib/image';
import type { CroppedImage } from '@/lib/cropImage';
import type { PostVisibility } from '@/types/api';
import SelectStage from './composer/SelectStage';
import CropStage from './composer/CropStage';
import CaptionStage from './composer/CaptionStage';
import UploadStage from './composer/UploadStage';
import DoneStage from './composer/DoneStage';

type Step = 'select' | 'crop' | 'caption' | 'upload' | 'done';

const STEP_TITLE: Record<Step, string> = {
  select: 'New post',
  crop: 'Crop',
  caption: 'Caption',
  upload: 'Sharing',
  done: 'Done',
};

// Global post-composer modal — a single instance mounted in AppLayout, driven by
// composerStore. Owns the 5-step state machine (select → crop → caption → upload
// → done); each stage owns its own Back/Next/Share buttons and reports up.
// Stages create + revoke their own preview object URLs, so closing the dialog
// (which unmounts the active stage) cleans them up.
export default function PostComposerModal() {
  const isOpen = useComposerStore((s) => s.isOpen);
  const close = useComposerStore((s) => s.close);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const create = useCreatePost();

  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [isPassthrough, setIsPassthrough] = useState(false);
  const [prepared, setPrepared] = useState<CroppedImage | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');

  const resetAll = () => {
    setStep('select');
    setFile(null);
    setDimensions(null);
    setIsPassthrough(false);
    setPrepared(null);
    setCaption('');
    setVisibility('PUBLIC');
    create.reset();
  };

  const closeAndReset = () => {
    close();
    resetAll();
  };

  // Step 4 → 5 once the mutation resolves.
  useEffect(() => {
    if (create.isSuccess && step === 'upload') setStep('done');
  }, [create.isSuccess, step]);

  const handleSelect = (f: File, dims: ImageDimensions) => {
    setFile(f);
    setDimensions(dims);
    setIsPassthrough(PASSTHROUGH_MIME.has(f.type));
    setStep('crop');
  };

  const handleBackToSelect = () => {
    setFile(null);
    setDimensions(null);
    setPrepared(null);
    setStep('select');
  };

  const handleCropped = (p: CroppedImage) => {
    setPrepared(p);
    setStep('caption');
  };

  const submitPost = () => {
    if (!prepared) return;
    create.submit({ caption, visibility, media: prepared });
  };

  const handleShare = () => {
    setStep('upload');
    submitPost();
  };

  const handleViewPost = () => {
    const id = create.createdPost?.id;
    closeAndReset();
    if (id) {
      navigate(`/posts/${id}`, {
        state: isDesktop ? { background: location } : undefined,
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'select':
        return <SelectStage onSelect={handleSelect} />;
      case 'crop':
        return file && dimensions ? (
          <CropStage
            file={file}
            dimensions={dimensions}
            isPassthrough={isPassthrough}
            onBack={handleBackToSelect}
            onComplete={handleCropped}
          />
        ) : null;
      case 'caption':
        return prepared ? (
          <CaptionStage
            prepared={prepared}
            caption={caption}
            visibility={visibility}
            onCaptionChange={setCaption}
            onVisibilityChange={setVisibility}
            onBack={() => setStep('crop')}
            onShare={handleShare}
          />
        ) : null;
      case 'upload':
        return (
          <UploadStage
            phase={create.phase}
            progress={create.progress}
            error={create.error}
            onRetry={submitPost}
            onBack={() => setStep('caption')}
          />
        );
      case 'done':
        return <DoneStage onViewPost={handleViewPost} onClose={closeAndReset} />;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeAndReset();
      }}
    >
      <DialogContent
        showClose
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex h-12 shrink-0 items-center justify-center border-b px-12">
          <DialogTitle className="text-base">{STEP_TITLE[step]}</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}
