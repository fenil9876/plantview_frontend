import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createMachine, deleteMachine, listMachines, updateMachine } from "../lib/machinesApi";
import type { Machine } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

export function MachinesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data: machines, isLoading } = useQuery({ queryKey: ["machines"], queryFn: listMachines });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["machines"] });

  const createMut = useMutation({
    mutationFn: () => createMachine({ name, code, type: type || null }),
    onSuccess: () => {
      setName("");
      setCode("");
      setType("");
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
    { header: "Name", cell: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
    { header: "Code", cell: (m) => <span className="text-slate-500">{m.code}</span> },
    { header: "Type", cell: (m) => m.type ?? "—" },
    {
      header: "Status",
      cell: (m) => <Badge tone={m.is_active ? "green" : "gray"}>{m.is_active ? "active" : "inactive"}</Badge>,
    },
    {
      header: "",
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => toggleMut.mutate(m)}>
            {m.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              confirm({
                title: "Delete machine",
                message: `Are you sure you want to delete "${m.name}"? This action cannot be undone.`,
                onConfirm: () => deleteMut.mutate(m.id),
              })
            }
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader title="Machines" subtitle="Register the machines used across your operations." />

      <Card title="Add machine">
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Type" hint="optional">
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="knitting…" />
          </Field>
          <Button type="submit" loading={createMut.isPending}>
            Add machine
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner label="Loading machines…" />
      ) : (
        <DataTable
          columns={columns}
          data={machines ?? []}
          rowKey={(m) => m.id}
          empty={
            <div className="flex flex-col items-center gap-1 py-4">
              <Boxes className="h-6 w-6 text-slate-300" />
              No machines yet.
            </div>
          }
        />
      )}
    </div>
  );
}
