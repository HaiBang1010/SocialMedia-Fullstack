import { ArrowLeft, Compass, Home } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Custom 404 — standalone (no app shell), Beng-branded. Uses semantic tokens so it follows the
// user's theme (light/dark). Rendered by the catch-all route for any unmatched path.
export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <span className="mb-10 font-heading text-2xl font-bold tracking-tight">
        Beng<span className="text-primary">.</span>
      </span>

      <div className="w-full max-w-md space-y-6">
        <Compass className="mx-auto size-20 animate-pulse text-primary" />

        <div className="space-y-2">
          <h1 className="font-heading text-7xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">Lost in the feed?</h2>
          <p className="text-muted-foreground">
            This page doesn&apos;t exist — or it expired like a 24-hour story.
          </p>
        </div>

        {/* The path that wasn't found. */}
        <p className="mx-auto max-w-full truncate rounded-md bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
          Couldn&apos;t find: {location.pathname}
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/')}>
            <Home className="size-4" />
            Back to feed
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
            Go back
          </Button>
        </div>

        <ul className="space-y-1 pt-2 text-sm text-muted-foreground">
          <li>• Double-check the URL for typos</li>
          <li>• Head back to your feed</li>
          <li>• Find people &amp; posts via Search</li>
        </ul>
      </div>
    </div>
  );
}
