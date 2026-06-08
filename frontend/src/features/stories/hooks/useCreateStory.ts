import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi, storiesApi, uploadToPresignedUrl } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { CroppedImage } from '@/lib/cropImage';
import type { VideoMedia } from '@/lib/video';
import type { CreateStoryInput, Story } from '@/types/api';

// Which leg of the flow we are on — drives the UploadStage label. Progress %
// only moves during 'uploading' (the S3 PUT); 'publishing' is the POST /stories.
export type CreateStoryPhase = 'idle' | 'uploading' | 'publishing';

// A single prepared media: a cropped 9:16 image (Phase 3.1 utilities) or a video
// + its poster (Phase 3.2 utilities). Discriminated by contentType.
export type StoryMediaPayload = CroppedImage | VideoMedia;

function isVideoPayload(m: StoryMediaPayload): m is VideoMedia {
  return m.contentType === 'video/mp4';
}

// Create a story end-to-end: presign → PUT the blob to S3 (with progress) → POST
// /stories. SINGLE media (image OR video) — no carousel. A video is two PUTs (the
// video, then its poster) weighted 90/10 into one CreateStoryInput. There is no
// optimistic cache write to roll back — a brand-new story has no real id/url until
// the server responds (same reasoning as useCreatePost). On success we invalidate
// the author's own user-stories list (their feed never contains their own story).
export function useCreateStory() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<CreateStoryPhase>('idle');

  const mutation = useMutation<Story, Error, StoryMediaPayload>({
    mutationFn: async (media) => {
      setPhase('uploading');
      setProgress(0);

      let input: CreateStoryInput;

      if (isVideoPayload(media)) {
        // 1) Video file (untouched). Weighs 90% of the bar.
        const videoPresign = await mediaApi.presign({
          contentType: media.contentType,
          size: media.blob.size,
        });
        const videoFile = new File([media.blob], 'upload', { type: media.contentType });
        await uploadToPresignedUrl(videoPresign.uploadUrl, videoFile, (p) =>
          setProgress(Math.round(p * 0.9)),
        );

        // 2) Poster (JPEG). Weighs the remaining 10%.
        const thumbPresign = await mediaApi.presign({
          contentType: media.thumbnailContentType,
          size: media.thumbnailBlob.size,
        });
        const thumbFile = new File([media.thumbnailBlob], 'poster', {
          type: media.thumbnailContentType,
        });
        await uploadToPresignedUrl(thumbPresign.uploadUrl, thumbFile, (p) =>
          setProgress(90 + Math.round(p * 0.1)),
        );

        input = {
          mediaType: 'VIDEO',
          mediaUrl: videoPresign.publicUrl,
          mediaObjectKey: videoPresign.objectKey,
          thumbnailUrl: thumbPresign.publicUrl,
          thumbnailObjectKey: thumbPresign.objectKey,
          duration: Math.round(media.duration),
          width: media.width,
          height: media.height,
        };
      } else {
        // Image: one presign + one PUT. contentType signed here MUST equal the
        // blob's type (and the PUT Content-Type) or S3 rejects the signature.
        const presign = await mediaApi.presign({
          contentType: media.contentType,
          size: media.blob.size,
        });
        const file = new File([media.blob], 'upload', { type: media.contentType });
        await uploadToPresignedUrl(presign.uploadUrl, file, setProgress);

        input = {
          mediaType: 'IMAGE',
          mediaUrl: presign.publicUrl,
          mediaObjectKey: presign.objectKey,
          width: media.width,
          height: media.height,
        };
      }

      setPhase('publishing');
      return storiesApi.create(input);
    },

    onSuccess: () => {
      if (me) {
        qc.invalidateQueries({ queryKey: queryKeys.userStories(me.username) });
      }
    },
  });

  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    createdStory: mutation.data,
    progress,
    phase,
    reset: () => {
      mutation.reset();
      setProgress(0);
      setPhase('idle');
    },
  };
}
