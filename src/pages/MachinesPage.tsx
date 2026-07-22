import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Power, Trash2 } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createMachine, deleteMachine, listMachines, updateMachine } from "../lib/machinesApi";
import type { Machine } from "../lib/types";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Fab,
  Field,
  Input,
  Modal,
  PageHeader,
  SkeletonList,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

export function MachinesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data: machines, isLoading } = useQuery({ queryKey: ["machines"], queryFn: listMachines });

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["machines"] });
  const closeForm = () => {
    setFormOpen(false);
    setName("");
    setCode("");
    setType("");
  };

  const createMut = useMutation({
    mutationFn: () => createMachine({ name, code, type: type || null }),
    onSuccess: () => {
      closeForm();
      toast.success("Machine added");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const toggleMut = useMutation({
    mutationFn: (m: Machine) => updateMachine(m.id, { is_active: !m.is_active }),
    onSuccess: (m) => {
      toast.success(`${m.name} ${m.is_active ? "activated" : "deactivated"}`);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteMachine(id),
    onSuccess: () => {
      toast.success("Machine deleted");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate();
  };

  const columns: Column<Machine>[] = [
    { header: "Name", primary: true, cell: (m) => <span className="font-semibold text-slate-900">{m.name}</span> },
    { header: "Code", cell: (m) => <span className="font-mono text-slate-600">{m.code}</span> },
    { header: "Type", cell: (m) => <span className="text-slate-600">{m.type ?? "—"}</span> },
    {
      header: "Status",
      cell: (m) => (
        <Badge tone={m.is_active ? "green" : "gray"} dot>
          {m.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (m) => (
        // Icon buttons rather than "Deactivate"/"Delete" labels: two labelled
        // buttons squeeze the machine name off a phone-width card.
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            title={m.is_active ? "Deactivate" : "Activate"}
            aria-label={`${m.is_active ? "Deactivate" : "Activate"} ${m.name}`}
            className={m.is_active ? "text-emerald-600 hover:text-slate-500" : "text-slate-400 hover:text-emerald-600"}
            loading={toggleMut.isPending && toggleMut.variables?.id === m.id}
            onClick={() => toggleMut.mutate(m)}
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Delete"
            aria-label={`Delete ${m.name}`}
            className="text-slate-400 hover:text-red-600"
            onClick={() =>
              confirm({
                title: "Delete machine",
                message: `Delete “${m.name}”? This cannot be undone.`,
                onConfirm: () => deleteMut.mutate(m.id),
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const list = machines ?? [];

  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader
        title="Machines"
        subtitle="Register the machines used across your operations."
        actions={
          <Button
            className="hidden sm:inline-flex"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setFormOpen(true)}
          >
            Add machine
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="No machines yet"
          description="Add the machines your operators record entries against."
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
              Add machine
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={list} rowKey={(m) => m.id} />
      )}

      <Fab onClick={() => setFormOpen(true)} icon={<Plus className="h-5 w-5" />} label="Add machine" />

      <Modal open={formOpen} onClose={closeForm} title="Add machine" size="sm">
        <form onSubmit={onCreate} className="space-y-4">
          <Field label="Name" required>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Code" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          <Field label="Type" hint="Optional — e.g. knitting, dyeing.">
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="knitting…" />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createMut.isPending}>
              Add machine
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
