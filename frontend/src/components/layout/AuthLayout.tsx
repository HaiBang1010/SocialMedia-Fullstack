import { useState } from "react";
import { Outlet } from "react-router-dom";

// Random poster per page load (Q1). Files live in /public; missing → gradient fallback (Q1 edge 1).
const POSTERS = ["/auth-poster-1.jpg", "/auth-poster-2.jpg", "/auth-poster-3.jpg"];

// Footer links — copied from RightRail.tsx (Q2). Keep in sync if those change.
const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "About", href: "https://www.linkedin.com/in/tphbang/" },
  { label: "Feedback", href: "https://forms.gle/pSELEVa8TFVXpo2v8" },
  { label: "GitHub", href: "https://github.com/HaiBang1010" },
  { label: "Portfolio", href: "https://portfolio-psi-rosy-hx6fl8dojd.vercel.app/" },
];

// Auth shell — FORCED LIGHT (Q3): the `.theme-light` class re-declares the light palette on this
// subtree, so login/register stay light even when the main app's `.dark` class is on <html> (theme
// isolation; the main app's dark mode + toggle are untouched). Layout: poster 60% / form 40% on
// desktop, footer full-width below; form-only stacked on mobile.
export default function AuthLayout() {
  // One random poster per mount (lazy init → stable across re-renders; a refresh re-rolls).
  const [posterIdx] = useState(() => Math.floor(Math.random() * POSTERS.length));
  const [posterFailed, setPosterFailed] = useState(false);

  return (
    <div className="theme-light flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1">
        {/* Left — random poster centered on a clean (white) panel, desktop only. No background fill;
            object-contain keeps the whole image. Missing file → centered brand wordmark fallback. */}
        <div className="hidden w-3/5 items-center justify-center p-10 md:flex">
          {posterFailed ? (
            <span className="font-heading text-5xl font-bold tracking-tight text-primary">
              Beng<span className="text-foreground">.</span>
            </span>
          ) : (
            <img
              src={POSTERS[posterIdx]}
              alt=""
              loading="eager"
              onError={() => setPosterFailed(true)}
              className="max-h-[50vh] max-w-full rounded-2xl object-contain "
            />
          )}
        </div>

        {/* Right — auth form (40%, full width on mobile). `my-auto` centers vertically when it fits
            and lets a tall form (register) scroll without clipping its top. */}
        <div className="flex w-full justify-center overflow-y-auto p-6 md:w-2/5">
          <div className="my-auto flex w-full flex-col items-center">
            {/* Compact brand for mobile (the poster panel is hidden < md). */}
            <span className="mb-8 font-heading text-2xl font-bold tracking-tight ">
              Beng<span className="text-primary">.</span>
            </span>
            <Outlet />
          </div>
        </div>
      </div>

      {/* Footer — full-width below the split (Q2). */}
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t px-6 py-4 text-xs text-muted-foreground">
        {FOOTER_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-80 transition-opacity hover:opacity-100 hover:underline"
          >
            {l.label}
          </a>
        ))}
        <span className="opacity-60">© 2026 Beng</span>
      </footer>
    </div>
  );
}
