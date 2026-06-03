import { cn } from '@/lib/utils';

// Up-to-two-letter fallback when a user has no avatar image.
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES = {
  xs: 'size-6 text-[0.6rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

interface AvatarUser {
  name: string;
  avatarUrl?: string | null;
}

interface AvatarProps {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
}

// Round avatar: shows the image when present, initials otherwise.
export default function Avatar({ user, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
        SIZES[size],
        className,
      )}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="size-full object-cover"
        />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}
