import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Boxes,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Palette,
  type LucideIcon,
  Layers,
  Menu,
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

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/templates", label: "Templates", icon: Layers, adminOnly: true },
  { to: "/batches", label: "Batches", icon: PackageSearch },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/design", label: "Design", icon: Palette },
  { to: "/machines", label: "Machines", icon: Boxes, adminOnly: true },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = hasRole("admin");

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <Layers className="h-5 w-5" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">PlantView</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand">
            {initials(user?.username ?? "?")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{user?.username}</div>
            <div className="truncate text-xs text-slate-400">{user?.email}</div>
          </div>
        </div>
        <div className="mt-1 space-y-0.5">
          <button
            onClick={() => {
              setMobileOpen(false);
              navigate("/change-password");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <KeyRound className="h-[18px] w-[18px]" />
            Change password
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar — sticky full-height so the account block stays put */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:block lg:sticky lg:top-0 lg:h-screen lg:self-start">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-pop animate-slide-in">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-slate-900">PlantView</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
