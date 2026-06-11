import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createBatch, listBatches } from "../lib/batchesApi";
import { listTemplates } from "../lib/templatesApi";
import { useAuth } from "../auth/AuthContext";
import type { BatchStatus, BatchSummary } from "../lib/types";
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  useToast,
  type Column,
} from "../components/ui";

export function BatchesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCreate = hasRole("admin", "operator");

  const [statusFilter, setStatusFilter] = useState<BatchStatus | "">("");
  const [code, setCode] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [lotSize, setLotSize] = useState("");

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches", statusFilter],
    queryFn: () => listBatches(statusFilter ? { status: statusFilter } : undefined),
  });
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });

  const activeTemplates = templates?.filter((t) => t.is_active) ?? [];
  const templateName = (id: number) => templates?.find((t) => t.id === id)?.name ?? `#${id}`;

  const createMut = useMutation({
    mutationFn: () =>
      createBatch({
        template_id: Number(templateId),
        code: code.trim(),
        lot_size: lotSize.trim() !== "" ? Number(lotSize) : null,
      }),
    onSuccess: (b) => {
      setCode("");
      setTemplateId("");
      setLotSize("");
      toast.success(`Batch ${b.code} created`);
      qc.invalidateQueries({ queryKey: ["batches"] });
      navigate(`/batches/${b.id}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!templateId || !code.trim()) return toast.error("Pick a template and enter a batch code");
    createMut.mutate();
  };

  const columns: Column<BatchSummary>[] = [
    { header: "Code", cell: (b) => <span className="font-medium text-slate-800">{b.code}</span> },
    { header: "Template", cell: (b) => <span className="text-slate-600">{templateName(b.template_id)}</span> },
    {
      header: "Lot size",
      cell: (b) =>
        b.lot_size != null ? (
          <span className="text-slate-700">{b.lot_size}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
    {
      header: "Created",
      cell: (b) => <span className="text-slate-400">{new Date(b.created_at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Batches" subtitle="Track lots as they move through your process stages." />

      {canCreate && (
        <Card title="Start a batch">
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-4">
            <Field label="Template" className="min-w-[220px] flex-1">
              <Select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select a template…</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (v{t.version})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Batch code" className="min-w-[180px] flex-1">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LOT-001" />
            </Field>
            <Field label="Lot size (qty)" className="min-w-[140px]">
              <Input
                type="number"
                step="any"
                min="0"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                placeholder="e.g. 1000"
              />
            </Field>
            <Button type="submit" loading={createMut.isPending}>
              Start batch
            </Button>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Filter</span>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BatchStatus | "")}
          >
            <option value="">All statuses</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Spinner label="Loading batches…" />
      ) : (
        <DataTable
          columns={columns}
          data={batches ?? []}
          rowKey={(b) => b.id}
          onRowClick={(b) => navigate(`/batches/${b.id}`)}
          empty={
            <div className="flex flex-col items-center gap-1 py-4">
              <PackageSearch className="h-6 w-6 text-slate-300" />
              No batches.
            </div>
          }
        />
      )}
    </div>
  );
}
