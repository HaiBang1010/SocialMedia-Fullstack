import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoneStageProps {
  onViewPost: () => void;
  onClose: () => void;
}

// Step 5 — terminal success screen after the post is published.
export default function DoneStage({ onViewPost, onClose }: DoneStageProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <CheckCircle2 className="size-14 text-primary" strokeWidth={1.5} />
      <div>
        <p className="font-heading text-lg font-semibold">Posted!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your post is live on your profile.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onViewPost}>View post</Button>
      </div>
    </div>
  );
}
