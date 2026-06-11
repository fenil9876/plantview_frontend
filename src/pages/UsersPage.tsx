import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../lib/api";
import { createUser, listUsers, updateUserRoles } from "../lib/usersApi";
import type { Role, User } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Spinner,
  useToast,
  type Column,
} from "../components/ui";

const ALL_ROLES: Role[] = ["admin", "operator", "viewer"];

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(["operator"]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });
  const toggleRole = (r: Role) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const createMut = useMutation({
    mutationFn: () => createUser({ email: email.trim(), username: username.trim(), password, roles }),
    onSuccess: () => {
      setEmail("");
      setUsername("");
      setPassword("");
      setRoles(["operator"]);
      toast.success("User created");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rolesMut = useMutation({
    mutationFn: (v: { id: number; roles: Role[] }) => updateUserRoles(v.id, v.roles),
    onSuccess: () => {
      toast.success("Roles updated");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || password.length < 8)
      return toast.error("Name, email and a password (8+ chars) are required");
    if (roles.length === 0) return toast.error("Pick at least one role");
    createMut.mutate();
  };

  const RoleChecks = ({ value, onToggle }: { value: Role[]; onToggle: (r: Role) => void }) => (
    <div className="flex gap-3">
      {ALL_ROLES.map((r) => (
        <label key={r} className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-brand focus:ring-brand/40"
            checked={value.includes(r)}
            onChange={() => onToggle(r)}
          />
          {r}
        </label>
      ))}
    </div>
  );

  const columns: Column<User>[] = [
    { header: "Name", cell: (u) => <span className="font-medium text-slate-800">{u.username}</span> },
    { header: "Email", cell: (u) => <span className="text-slate-600">{u.email}</span> },
    {
      header: "Roles",
      cell: (u) => (
        <RoleChecks
          value={u.roles}
          onToggle={(r) =>
            rolesMut.mutate({
              id: u.id,
              roles: u.roles.includes(r) ? u.roles.filter((x) => x !== r) : [...u.roles, r],
            })
          }
        />
      ),
    },
    {
      header: "Status",
      cell: (u) => <Badge tone={u.is_active ? "green" : "gray"}>{u.is_active ? "active" : "inactive"}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Manage who can access PlantView and what they can do." />

      <Card title="Add user">
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:items-end">
          <Field label="Name">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" hint="min 8 characters">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Roles">
            <div className="flex h-10 items-center">
              <RoleChecks value={roles} onToggle={toggleRole} />
            </div>
          </Field>
          <Button type="submit" loading={createMut.isPending} className="md:col-span-2 lg:col-span-1">
            Add user
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner label="Loading users…" />
      ) : (
        <DataTable columns={columns} data={users ?? []} rowKey={(u) => u.id} />
      )}
    </div>
  );
}
