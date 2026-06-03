import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
}

// Inline loading indicator. Size/color via className (defaults to muted, size-5).
export default function Spinner({ className }: SpinnerProps) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-muted-foreground', className)}
      aria-label="Loading"
    />
  );
}
