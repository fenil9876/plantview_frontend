import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Loader2, Search, UserPlus, Users as UsersIcon, X } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createUser, listUsers, updateUserRoles } from "../lib/usersApi";
import { useAuth } from "../auth/AuthContext";
import type { Role, User } from "../lib/types";
import {
  Badge,
  Button,
  cn,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
} from "../components/ui";

const ALL_ROLES: Role[] = ["admin", "operator", "viewer"];

const ROLE_META: Record<Role, { label: string; desc: string; active: string }> = {
  admin: {
    label: "Admin",
    desc: "Full access — manage users, templates and everything else.",
    active: "border-red-300 bg-red-50 text-red-700",
  },
  operator: {
    label: "Operator",
    desc: "Create batches and enter or edit production data.",
    active: "border-indigo-300 bg-indigo-50 text-indigo-700",
  },
  viewer: {
    label: "Viewer",
    desc: "Read-only — can view batches and dashboards.",
    active: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

/** A toggleable role pill. */
function RolePill({
  role,
  active,
  disabled,
  onClick,
}: {
  role: Role;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? ROLE_META[role].active
          : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {ROLE_META[role].label}
    </button>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const { confirm, dialog } = useConfirm();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const rolesMut = useMutation({
    mutationFn: (v: { id: number; roles: Role[] }) => updateUserRoles(v.id, v.roles),
    onSuccess: () => {
      toast.success("Roles updated");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const all = users ?? [];
  const adminCount = all.filter((u) => u.roles.includes("admin")).length;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : all;

  const toggleUserRole = (u: User, r: Role) => {
    const has = u.roles.includes(r);
    const next = has ? u.roles.filter((x) => x !== r) : [...u.roles, r];
    if (next.length === 0) {
      toast.error("A user must keep at least one role.");
      return;
    }
    if (has && r === "admin") {
      if (adminCount <= 1) {
        toast.error("You can't remove the last admin.");
        return;
      }
      if (u.id === me?.id) {
        confirm({
          title: "Remove your own admin access?",
          message:
            "You'll immediately lose access to admin-only pages like Users, Templates and Machines.",
          confirmLabel: "Remove my admin",
          onConfirm: () => rolesMut.mutate({ id: u.id, roles: next }),
        });
        return;
      }
    }
    rolesMut.mutate({ id: u.id, roles: next });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage who can access PlantView and what they can do."
        actions={
          <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add user
          </Button>
        }
      />

      {/* Search + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!isLoading && (
          <span className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "user" : "users"}
          </span>
        )}
      </div>

      {isLoading ? (
        <Spinner label="Loading users…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title={q ? "No matching users" : "No users yet"}
          description={q ? `Nothing matches “${search.trim()}”.` : "Add your first user to get started."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((u) => {
            const saving = rolesMut.isPending && rolesMut.variables?.id === u.id;
            const isYou = u.id === me?.id;
            return (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand">
                    {initials(u.username)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-800">{u.username}</span>
                      {isYou && <Badge tone="indigo">You</Badge>}
                      <Badge tone={u.is_active ? "green" : "gray"}>
                        {u.is_active ? "active" : "inactive"}
                      </Badge>
                    </div>
                    <div className="truncate text-sm text-slate-500">{u.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0 sm:justify-end">
                  {saving && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_ROLES.map((r) => (
                      <RolePill
                        key={r}
                        role={r}
                        active={u.roles.includes(r)}
                        disabled={saving}
                        onClick={() => toggleUserRole(u, r)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role legend */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          What each role can do
        </div>
        <ul className="space-y-1.5 text-sm text-slate-600">
          {ALL_ROLES.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <span className={cn("mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", ROLE_META[r].active)}>
                {ROLE_META[r].label}
              </span>
              <span>{ROLE_META[r].desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Tap a role to grant or remove it — changes save instantly.
        </p>
      </div>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={invalidate} />

      {dialog}
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [roles, setRoles] = useState<Role[]>(["operator"]);

  const reset = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setShowPw(false);
    setRoles(["operator"]);
  };

  const createMut = useMutation({
    mutationFn: () => createUser({ email: email.trim(), username: username.trim(), password, roles }),
    onSuccess: () => {
      toast.success("User created");
      reset();
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const toggleRole = (r: Role) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) return toast.error("Name and email are required.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (roles.length === 0) return toast.error("Pick at least one role.");
    createMut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add user" description="Create a login and choose what they can do.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Priya Shah" autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          </Field>
        </div>

        <Field label="Password" hint="Minimum 8 characters.">
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Roles">
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => (
              <RolePill key={r} role={r} active={roles.includes(r)} onClick={() => toggleRole(r)} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {roles.length ? roles.map((r) => ROLE_META[r].desc).join(" ") : "Pick at least one role."}
          </p>
        </Field>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createMut.isPending}>
            Add user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
