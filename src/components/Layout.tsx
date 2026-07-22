import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Boxes,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Palette,
  type LucideIcon,
  Layers,
  PackageSearch,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { cn } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  adminOnly?: boolean;
}

/**
 * The four things an operator opens every shift. These are the bottom tabs on
 * a phone; everything else is one tap further away behind "More".
 */
const PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/batches", label: "Batches", icon: PackageSearch },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/design", label: "Design", icon: Palette },
];

/** Setup and administration — visited occasionally, mostly from a desktop. */
const SECONDARY: NavItem[] = [
  { to: "/templates", label: "Templates", icon: Layers, adminOnly: true },
  { to: "/machines", label: "Machines", icon: Boxes, adminOnly: true },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = hasRole("admin");

  const secondary = SECONDARY.filter((i) => !i.adminOnly || isAdmin);

  // Navigating away should never leave the sheet hanging over the new page.
  useEffect(() => setMoreOpen(false), [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const onSecondaryRoute = secondary.some((i) => location.pathname.startsWith(i.to));

  /* ------------------------------- desktop -------------------------------- */

  const sidebarLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-brand text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
          <Layers className="h-5 w-5" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">PlantView</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {PRIMARY.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLink}>
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {secondary.length > 0 && (
          <>
            <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Setup
            </div>
            {secondary.map((item) => (
              <NavLink key={item.to} to={item.to} className={sidebarLink}>
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
            {initials(user?.username ?? "?")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{user?.username}</div>
            <div className="truncate text-xs text-slate-500">{user?.email}</div>
          </div>
        </div>
        <div className="mt-1 space-y-0.5">
          <button
            onClick={() => navigate("/change-password")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <KeyRound className="h-[18px] w-[18px]" />
            Change password
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );

  /* -------------------------------- mobile -------------------------------- */

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors",
      isActive ? "text-brand" : "text-slate-500 active:bg-slate-100",
    );

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar — sticky full-height so the account block stays put */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:block lg:sticky lg:top-0 lg:h-screen lg:self-start">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim mobile brand bar. Page titles live in each page's header, so
            this only has to hold identity and stay out of the way. */}
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
            <Layers className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight text-slate-900">PlantView</span>
        </header>

        {/* Bottom padding on mobile clears the tab bar and the home indicator. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        <div className="flex items-stretch gap-0.5 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-1.5">
          {PRIMARY.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
              {({ isActive }) => (
                <>
                  <item.icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={isActive ? 2.4 : 1.8}
                    aria-hidden="true"
                  />
                  <span className={cn("text-[11px]", isActive ? "font-semibold" : "font-medium")}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors",
              onSecondaryRoute || moreOpen ? "text-brand" : "text-slate-500 active:bg-slate-100",
            )}
          >
            <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet — setup sections plus the account actions */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/50 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-sheet animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-1 pt-2.5">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
                {initials(user?.username ?? "?")}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{user?.username}</div>
                <div className="truncate text-sm text-slate-500">{user?.email}</div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-2">
              {secondary.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium",
                      isActive ? "bg-brand-50 text-brand-800" : "text-slate-700 active:bg-slate-100",
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0 text-slate-400" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => navigate("/change-password")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium text-slate-700 active:bg-slate-100"
              >
                <KeyRound className="h-5 w-5 shrink-0 text-slate-400" />
                Change password
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium text-red-600 active:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
