import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  Home,
  LogOut,
  Search,
  Send,
  Settings,
  SquarePlus,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/stores/authStore";
import { useComposerStore } from "@/stores/composerStore";
import { useUnreadTotal } from "@/features/messaging/hooks/useUnreadTotal";
import { useNotificationsUnreadCount } from "@/features/notifications/hooks/useNotifications";
import ThemeToggle from "@/components/ThemeToggle";

interface NavEntry {
  label: string;
  icon: LucideIcon;
  // `to` → real NavLink; `action` → button handler; neither → disabled (Phase 2+).
  to?: string;
  action?: "create";
  // Phase 7 — which unread badge to show on this entry.
  badge?: "messages" | "notifications";
}

const NAV: NavEntry[] = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Messages", icon: Send, to: "/messages", badge: "messages" },
  { label: "Notifications", icon: Heart, to: "/notifications", badge: "notifications" },
  { label: "Create", icon: SquarePlus, action: "create" },
  { label: "Profile", icon: User, to: "/profile" },
];

const ROW = "flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm transition-colors";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Small count pill shown on the Messages / Notifications nav entries (expanded sidebar).
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

interface SidebarProps {
  // 'collapsed' (e.g. on /messages): icon-only 64px, hover-expands to a 240px overlay.
  // 'default' (everywhere else): unchanged full 240px sidebar.
  variant?: "default" | "collapsed";
}

export default function Sidebar({ variant = "default" }: SidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openComposer = useComposerStore((s) => s.open);
  const unreadMessages = useUnreadTotal().data ?? 0;
  const unreadNotifications = useNotificationsUnreadCount().data ?? 0;
  const badgeCount = (badge?: NavEntry["badge"]) =>
    badge === "messages"
      ? unreadMessages
      : badge === "notifications"
        ? unreadNotifications
        : 0;

  const collapsed = variant === "collapsed";
  const [expanded, setExpanded] = useState(false);
  // Labels show in the default sidebar always, and in the collapsed sidebar only while expanded.
  const showLabels = !collapsed || expanded;

  // Hover with a 200ms enter/leave delay (prevents accidental trigger + wobble flicker).
  const enterTimer = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => setExpanded(true), 200);
  };
  const handleLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setExpanded(false), 200);
  };
  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );
  // Collapse on route change (clicking an item while hover-expanded then navigating).
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  const handleLogout = async () => {
    // Clear the httpOnly refresh cookie server-side; clear client state regardless of the result.
    try {
      await authApi.logout();
    } catch {
      // ignore — still log out locally
    }
    logout();
    navigate("/login", { replace: true });
  };

  const aside = (
    <aside
      onMouseEnter={collapsed ? handleEnter : undefined}
      onMouseLeave={collapsed ? handleLeave : undefined}
      className={cn(
        "hidden flex-col border-r bg-sidebar py-5 md:flex",
        collapsed
          ? cn(
              "absolute inset-y-0 left-0 z-50 overflow-hidden whitespace-nowrap transition-[width] duration-200",
              expanded ? "w-60 px-3 shadow-xl" : "w-16 px-2",
            )
          : "w-60 shrink-0 px-3",
      )}
    >
      {/* Logo — full "Beng." expanded, compact "B." when collapsed. */}
      <NavLink
        to="/"
        className={cn(
          "font-heading text-2xl font-bold tracking-tight",
          showLabels ? "px-3" : "text-center",
        )}
      >
        {showLabels ? "Beng" : "B"}
        <span className="text-primary">.</span>
      </NavLink>

      {/* Nav */}
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV.map(({ label, icon: Icon, to, action, badge }) => {
          if (to) {
            return (
              <NavLink
                key={label}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    ROW,
                    "hover:bg-muted",
                    !showLabels && "justify-center",
                    isActive && "font-bold text-primary",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative flex shrink-0">
                      <Icon strokeWidth={isActive ? 2.5 : 2} />
                      {/* Collapsed: unread shown as a dot (the count pill needs the label width). */}
                      {!showLabels && badgeCount(badge) > 0 && (
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
                      )}
                    </span>
                    {showLabels && <span className="truncate">{label}</span>}
                    {showLabels && <NavBadge count={badgeCount(badge)} />}
                  </>
                )}
              </NavLink>
            );
          }

          if (action === "create") {
            return (
              <button
                key={label}
                type="button"
                onClick={openComposer}
                className={cn(ROW, "hover:bg-muted", !showLabels && "justify-center")}
              >
                <Icon />
                {showLabels && <span>{label}</span>}
              </button>
            );
          }

          return (
            <button
              key={label}
              type="button"
              disabled
              aria-disabled="true"
              className={cn(ROW, "cursor-not-allowed opacity-60", !showLabels && "justify-center")}
            >
              <Icon />
              {showLabels && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 flex flex-col gap-1 border-t pt-4">
        {user && (
          <NavLink
            to="/profile"
            className={cn(ROW, "hover:bg-muted", !showLabels && "justify-center")}
          >
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="size-6 object-cover" />
              ) : (
                initials(user.name)
              )}
            </span>
            {showLabels && <span className="truncate">@{user.username}</span>}
          </NavLink>
        )}

        <div className={cn("flex items-center gap-4 px-3 py-2.5", !showLabels && "justify-center")}>
          <ThemeToggle />
          {showLabels && <span className="text-sm text-muted-foreground">Theme</span>}
        </div>

        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(ROW, "cursor-not-allowed opacity-60", !showLabels && "justify-center")}
        >
          <Settings />
          {showLabels && <span>Settings</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(ROW, "hover:bg-muted", !showLabels && "justify-center")}
        >
          <LogOut />
          {showLabels && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );

  if (!collapsed) return aside;
  // Permanent 64px spacer holds the flex slot; the aside is absolute inside it and grows
  // 64→240 on hover WITHOUT reflowing the rest of the layout (Q4 overlay-not-push).
  return <div className="relative hidden w-16 shrink-0 md:block">{aside}</div>;
}
