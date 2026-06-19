import { useSuggestedUsers } from "@/features/users/hooks/useSuggestedUsers";
import SuggestedUserCard from "@/components/users/SuggestedUserCard";
import { Skeleton } from "@/components/ui/skeleton";

// Static footer labels + the one real external link (Feedback → Google Form).
const FOOTER_LINKS: { label: string; href?: string }[] = [
  { label: "About", href: "https://www.linkedin.com/in/tphbang/" },
  { label: "Feedback", href: "https://forms.gle/pSELEVa8TFVXpo2v8" },
  { label: "GitHub", href: "https://github.com/HaiBang1010" },
  { label: "Portfolio", href: "https://portfolio-psi-rosy-hx6fl8dojd.vercel.app/" },
];

// Desktop right column (lg+). Real suggested accounts (top 5 of the shared suggested-users query)
// + a static footer. Hidden on smaller screens; the empty-feed grid covers discovery there.
export default function RightRail() {
  const { data: users, isLoading } = useSuggestedUsers();
  const top = users?.slice(0, 5) ?? [];

  return (
    <aside className="hidden w-72 shrink-0 border-l px-6 py-8 lg:block">
      <span className="text-sm font-semibold text-muted-foreground">
        Suggested for you
      </span>

      {isLoading ? (
        <ul className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </li>
          ))}
        </ul>
      ) : top.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No suggestions right now.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {top.map((u) => (
            <li key={u.id}>
              <SuggestedUserCard user={u} compact />
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-8 flex flex-col gap-3 text-xs text-muted-foreground">
        <nav className="flex flex-wrap gap-x-2 gap-y-1">
          {FOOTER_LINKS.map((link) =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 transition-opacity hover:opacity-100 hover:underline"
              >
                {link.label}
              </a>
            ) : (
              <span key={link.label} className="opacity-70">
                {link.label}
              </span>
            ),
          )}
        </nav>
        <span>© 2026 Beng</span>
      </footer>
    </aside>
  );
}
