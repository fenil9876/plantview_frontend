import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageSearch, Plus, Search, Trash2, X } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createBatch, deleteBatch, listBatches } from "../lib/batchesApi";
import { listTemplates } from "../lib/templatesApi";
import { useDebounced } from "../lib/useDebounced";
import { useAuth } from "../auth/AuthContext";
import type { BatchStatus, BatchSummary } from "../lib/types";
import {
  Button,
  DataTable,
  EmptyState,
  Fab,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonList,
  StatusBadge,
  cn,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

const STATUS_FILTERS: { value: BatchStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "in_progress", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

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
  const [createOpen, setCreateOpen] = useState(false);
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

  const closeCreate = () => {
    setCreateOpen(false);
    setCode("");
    setTemplateId("");
    setLotSize("");
  };

  const createMut = useMutation({
    mutationFn: () =>
      createBatch({
        template_id: Number(templateId),
        code: code.trim(),
        lot_size: lotSize.trim() !== "" ? Number(lotSize) : null,
      }),
    onSuccess: (b) => {
      closeCreate();
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
    {
      header: "Code",
      primary: true,
      // Lot codes are compared down a column — monospace keeps them aligned.
      cell: (b) => <span className="font-mono font-semibold text-slate-900">{b.code}</span>,
    },
    { header: "Template", cell: (b) => <span className="text-slate-600">{templateName(b.template_id)}</span> },
    {
      header: "Lot size",
      cell: (b) =>
        b.lot_size != null ? (
          <span className="tabular text-slate-700">{b.lot_size}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
    {
      header: "Created",
      cell: (b) => (
        <span className="tabular text-slate-500">{new Date(b.created_at).toLocaleDateString()}</span>
      ),
    },
    ...(canDelete
      ? [
          {
            header: "",
            align: "right" as const,
            cell: (b: BatchSummary) => (
              <Button
                variant="ghost"
                size="icon"
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

  const list = batches ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Batches"
        subtitle="Track lots as they move through your process stages."
        actions={
          canCreate ? (
            // Hidden on mobile — the FAB carries this action within thumb reach.
            <Button
              className="hidden sm:inline-flex"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Start batch
            </Button>
          ) : undefined
        }
      />

      {/* Search + status. Sticky so the filters stay usable while scrolling a
          long lot list on a phone. */}
      <div className="sticky top-[3.25rem] z-20 -mx-4 space-y-2.5 border-b border-slate-200 bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch code…"
            aria-label="Search batches by code"
            type="search"
            className="pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Chips instead of a <select>: one tap to filter rather than open a
            picker, scroll, choose, dismiss. */}
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value || "all"}
                onClick={() => setStatusFilter(f.value)}
                aria-pressed={active}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-600 active:bg-slate-100",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title={debouncedSearch ? "No matching batches" : "No batches yet"}
          description={
            debouncedSearch
              ? `Nothing matches “${debouncedSearch}”. Try a shorter code.`
              : statusFilter
                ? "No batches with this status. Try a different filter."
                : "Start a batch to begin tracking a lot through your stages."
          }
          action={
            canCreate && !debouncedSearch && !statusFilter ? (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Start batch
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={list}
          rowKey={(b) => b.id}
          onRowClick={(b) => navigate(`/batches/${b.id}`)}
        />
      )}

      {canCreate && (
        <Fab onClick={() => setCreateOpen(true)} icon={<Plus className="h-5 w-5" />} label="New batch" />
      )}

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Start a batch"
        description="Pick the process template this lot will follow."
        size="sm"
      >
        <form onSubmit={onCreate} className="space-y-4">
          <Field label="Template" required>
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
          <Field label="Batch code" required hint="Must be unique. Codes are never reused.">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LOT-001"
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          <Field label="Lot size (qty)" hint="Optional — used to track planned vs. actual.">
            <Input
              type="number"
              step="any"
              min="0"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="e.g. 1000"
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" loading={createMut.isPending}>
              Start batch
            </Button>
          </div>
        </form>
      </Modal>

      {dialog}
    </div>
  );
}
