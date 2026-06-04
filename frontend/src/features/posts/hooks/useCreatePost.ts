import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi, postsApi, uploadToPresignedUrl } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { CroppedImage } from '@/lib/cropImage';
import type { MediaInput, Post, PostVisibility } from '@/types/api';

// Which leg of the flow we are on — drives the UploadStage label. Progress %
// only moves during 'uploading' (the S3 PUT); 'publishing' is the POST /posts.
export type CreatePostPhase = 'idle' | 'uploading' | 'publishing';

export interface CreatePostPayload {
  caption?: string;
  visibility: PostVisibility;
  // Prepared media (cropped or passthrough). Omit for a caption-only post.
  media?: CroppedImage;
}

// Create a post end-to-end: presign → PUT the blob to S3 (with progress) →
// POST /posts. There is no optimistic cache write to roll back — a brand-new
// post has no real id/url until the server responds, and reconciling a temp id
// inside a cursor-paginated grid is the exact fragility useCreateComment avoids.
//
// On success we seed the detail cache (so "View post" is instant) and invalidate
// the author's own profile grid. We deliberately do NOT touch the feed: the feed
// only contains posts by people you follow (you never follow yourself), so a new
// post of yours never belongs there — refetching it would just cost scroll.
export function useCreatePost() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<CreatePostPhase>('idle');

  const mutation = useMutation<Post, Error, CreatePostPayload>({
    mutationFn: async ({ caption, visibility, media }) => {
      let mediaInput: MediaInput[] | undefined;

      if (media) {
        setPhase('uploading');
        setProgress(0);

        // contentType signed here MUST equal the blob's type (and the PUT
        // Content-Type) or S3 rejects the signature.
        const presign = await mediaApi.presign({
          contentType: media.contentType,
          size: media.blob.size,
        });
        const file = new File([media.blob], 'upload', {
          type: media.contentType,
        });
        await uploadToPresignedUrl(presign.uploadUrl, file, setProgress);

        mediaInput = [
          {
            url: presign.publicUrl,
            objectKey: presign.objectKey,
            width: media.width,
            height: media.height,
          },
        ];
      }

      setPhase('publishing');
      const trimmed = caption?.trim();
      return postsApi.create({
        caption: trimmed ? trimmed : undefined,
        visibility,
        media: mediaInput,
      });
    },

    onSuccess: (post) => {
      qc.setQueryData(queryKeys.post(post.id), post);
      if (me) {
        qc.invalidateQueries({ queryKey: queryKeys.userPosts(me.username) });
      }
    },
  });

  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    createdPost: mutation.data,
    progress,
    phase,
    reset: () => {
      mutation.reset();
      setProgress(0);
      setPhase('idle');
    },
  };
}
