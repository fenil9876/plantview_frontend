import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageSearch, Search, Trash2, X } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createBatch, deleteBatch, listBatches } from "../lib/batchesApi";
import { listTemplates } from "../lib/templatesApi";
import { useDebounced } from "../lib/useDebounced";
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
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

export function BatchesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { confirm, dialog } = useConfirm();
  const canCreate = hasRole("admin", "operator");
  const canDelete = hasRole("admin");

  const [statusFilter, setStatusFilter] = useState<BatchStatus | "">("");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [lotSize, setLotSize] = useState("");

  // Debounced so typing a code doesn't fire a request per keystroke.
  const debouncedSearch = useDebounced(search.trim());

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches", statusFilter, debouncedSearch],
    queryFn: () =>
      listBatches({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
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

  const deleteMut = useMutation({
    mutationFn: (b: BatchSummary) => deleteBatch(b.id),
    onSuccess: (_r, b) => {
      toast.success(`Batch ${b.code} deleted`);
      qc.invalidateQueries({ queryKey: ["batches"] });
      // Deleted batches drop out of the dashboard metrics too.
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["an"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!templateId || !code.trim()) return toast.error("Pick a template and enter a batch code");
    createMut.mutate();
  };

  const onDelete = (b: BatchSummary) =>
    confirm({
      title: `Delete batch ${b.code}?`,
      message:
        "It will be hidden from the batch list and dashboard. Nothing is erased — its entries are kept, " +
        "any materials it consumed stay deducted from inventory, and the code stays reserved.",
      confirmLabel: "Delete batch",
      onConfirm: () => deleteMut.mutate(b),
    });

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
    ...(canDelete
      ? [
          {
            header: "",
            align: "right" as const,
            cell: (b: BatchSummary) => (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete batch ${b.code}`}
                className="text-slate-400 hover:text-red-600"
                loading={deleteMut.isPending && deleteMut.variables?.id === b.id}
                onClick={(e) => {
                  e.stopPropagation(); // the row itself navigates to the batch
                  onDelete(b);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch code…"
            aria-label="Search batches by code"
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
              {debouncedSearch ? `No batches match “${debouncedSearch}”.` : "No batches."}
            </div>
          }
        />
      )}

      {dialog}
    </div>
  );
}
