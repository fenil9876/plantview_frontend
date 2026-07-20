import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiErrorMessage, apiValidationErrors } from "../lib/api";
import {
  createStageEntriesBulk,
  createStageEntry,
  deleteStageEntry,
  getBatch,
  setBatchColorTargets,
  setBatchDesigns,
  setBatchMaterials,
  updateBatch,
  updateBatchStatus,
  updateStageEntry,
} from "../lib/batchesApi";
import { getTemplate } from "../lib/templatesApi";
import { listMachines } from "../lib/machinesApi";
import { listInventory } from "../lib/inventoryApi";
import { listColors, listDesigns } from "../lib/designApi";
import { useAuth } from "../auth/AuthContext";
import {
  Badge,
  Button,
  Card,
  cn,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  useToast,
  type Column,
} from "../components/ui";
import { StageEntryForm } from "../components/StageEntryForm";
import { MultiColorEntryForm } from "../components/MultiColorEntryForm";
import type {
  BatchColorTarget,
  BatchDesign,
  BatchMaterial,
  BatchRead,
  BatchStatus,
  FieldDef,
  Machine,
  Stage,
  StageEntry,
  StageEntrySubmit,
  TemplateRead,
  ValidationFieldError,
} from "../lib/types";

const NO_COLOR = "#94a3b8"; // slate-400, used for missing/unspecified color hex

function fmt(v: unknown): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (v == null || v === "") return "—";
  return String(v);
}

/** Quantity recorded on a single entry: summed machine quantities for machine
 *  stages, else the built-in "quantity" stage field. */
function entryQuantity(stage: Stage, e: StageEntry): number {
  if (stage.has_machines) {
    return e.machine_entries.reduce((s, me) => s + (me.quantity ?? 0), 0);
  }
  const q = Number(e.data["quantity"]);
  return Number.isFinite(q) ? q : 0;
}

/** Total quantity produced at a stage across all its entries. */
function stageQuantity(stage: Stage, entries: StageEntry[]): number {
  return entries.reduce((sum, e) => sum + entryQuantity(stage, e), 0);
}

/** Quantity at a stage grouped by color id (null = no color). */
function perColorAtStage(stage: Stage, entries: StageEntry[]): Map<number | null, number> {
  const m = new Map<number | null, number>();
  for (const e of entries) {
    m.set(e.color_id, (m.get(e.color_id) ?? 0) + entryQuantity(stage, e));
  }
  return m;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Green "done" + red "remaining" pills, shown against the lot size. */
function QtyCounts({ done, lotSize }: { done: number; lotSize: number | null }) {
  const remaining = lotSize != null ? Math.max(0, round2(lotSize - done)) : null;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700"
        title="Quantity done at this stage"
      >
        {round2(done)} done
      </span>
      {remaining != null && (
        <span
          className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700"
          title="Remaining vs. lot size"
        >
          {remaining} left
        </span>
      )}
    </div>
  );
}

export function BatchDetailPage() {
  const { id } = useParams();
  const batchId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const { user, hasRole } = useAuth();
  const canEnter = hasRole("admin", "operator");
  const isAdmin = hasRole("admin");

  const { data: batch, isLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => getBatch(batchId),
  });
  const { data: template } = useQuery({
    queryKey: ["template", batch?.template_id],
    queryFn: () => getTemplate(batch!.template_id),
    enabled: !!batch,
  });
  const { data: machines } = useQuery({ queryKey: ["machines"], queryFn: listMachines });

  const [statsOpen, setStatsOpen] = useState(false);
  const [setup, setSetup] = useState<null | "lot" | "designs" | "colors" | "materials">(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["batch", batchId] });

  const statusMut = useMutation({
    mutationFn: (status: BatchStatus) => updateBatchStatus(batchId, status),
    onSuccess: (b) => {
      toast.success(`Batch ${b.status.replace("_", " ")}`);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !batch || !template) return <Spinner label="Loading batch…" />;

  const stageName = (sid: number | null) =>
    sid ? template.stages.find((s) => s.id === sid)?.name ?? "—" : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.code}
        backTo="/batches"
        backLabel="Batches"
        subtitle={
          <>
            {template.name} · current stage: <strong>{stageName(batch.current_stage_id)}</strong>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<BarChart3 className="h-4 w-4" />}
              disabled={batch.color_targets.length === 0}
              title={
                batch.color_targets.length === 0
                  ? "Add a color split below to enable statistics"
                  : "Color-wise breakdown by stage"
              }
              onClick={() => setStatsOpen(true)}
            >
              Show statistics
            </Button>
            <StatusBadge status={batch.status} />
            {canEnter && batch.status === "in_progress" && (
              <>
                <Button variant="secondary" onClick={() => statusMut.mutate("completed")}>
                  Mark complete
                </Button>
                <Button variant="outline" onClick={() => statusMut.mutate("cancelled")}>
                  Cancel
                </Button>
              </>
            )}
            {canEnter && batch.status !== "in_progress" && (
              <Button variant="secondary" onClick={() => statusMut.mutate("in_progress")}>
                Reopen
              </Button>
            )}
          </>
        }
      />

      <Card className="py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SetupTile
            label="Lot size"
            value={batch.lot_size != null ? String(batch.lot_size) : "Not set"}
            muted={batch.lot_size == null}
            onClick={() => setSetup("lot")}
          />
          <SetupTile
            label="Designs"
            value={
              batch.designs.length
                ? `${batch.designs.length} design${batch.designs.length === 1 ? "" : "s"}`
                : "All"
            }
            muted={batch.designs.length === 0}
            onClick={() => setSetup("designs")}
          />
          <SetupTile
            label="Color split"
            value={
              batch.color_targets.length
                ? `${batch.color_targets.length} color${batch.color_targets.length === 1 ? "" : "s"}`
                : "Not set"
            }
            muted={batch.color_targets.length === 0}
            onClick={() => setSetup("colors")}
          />
          <SetupTile
            label="Materials consumed"
            value={
              batch.materials.length
                ? `${batch.materials.length} item${batch.materials.length === 1 ? "" : "s"}`
                : "None"
            }
            muted={batch.materials.length === 0}
            onClick={() => setSetup("materials")}
          />
        </div>
      </Card>

      <Modal
        open={setup === "lot"}
        onClose={() => setSetup(null)}
        title="Lot size"
        description="Target total quantity for this lot. Each stage is measured against it."
      >
        <LotSizeBody
          batchId={batchId}
          lotSize={batch.lot_size}
          canEnter={canEnter}
          onClose={() => setSetup(null)}
          onChanged={refresh}
        />
      </Modal>

      <Modal
        open={setup === "designs"}
        onClose={() => setSetup(null)}
        title="Designs"
        description="Pick the designs this lot runs, to narrow the design list during entry. Leave every box unticked to offer all designs."
        size="lg"
      >
        <DesignsBody
          batchId={batchId}
          selected={batch.designs}
          canEnter={canEnter}
          onClose={() => setSetup(null)}
          onChanged={refresh}
        />
      </Modal>

      <Modal
        open={setup === "colors"}
        onClose={() => setSetup(null)}
        title="Color split"
        description="Optional planned quantity per color. Set it to unlock color-wise statistics and limit the colors operators can pick."
        size="lg"
      >
        <ColorSplitBody
          batchId={batchId}
          lotSize={batch.lot_size}
          targets={batch.color_targets}
          canEnter={canEnter}
          onClose={() => setSetup(null)}
          onChanged={refresh}
        />
      </Modal>

      <Modal
        open={setup === "materials"}
        onClose={() => setSetup(null)}
        title="Materials consumed"
        description="Drawn from inventory when the lot starts. Editing reconciles the difference with stock."
        size="lg"
      >
        <MaterialsBody
          batchId={batchId}
          materials={batch.materials}
          canEnter={canEnter}
          onClose={() => setSetup(null)}
          onChanged={refresh}
        />
      </Modal>

      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        template={template}
        batch={batch}
      />

      {template.stages.map((stage) => (
        <StageCard
          key={stage.id}
          batchId={batchId}
          stage={stage}
          machines={machines ?? []}
          entries={batch.stage_entries.filter((e) => e.stage_id === stage.id)}
          lotSize={batch.lot_size}
          colorTargets={batch.color_targets}
          lotDesigns={batch.designs}
          isCurrent={batch.current_stage_id === stage.id}
          canEnter={canEnter}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? -1}
          onChanged={refresh}
        />
      ))}

      <LotSummary template={template} batch={batch} />
    </div>
  );
}

function LotSummary({ template, batch }: { template: TemplateRead; batch: BatchRead }) {
  if (batch.lot_size == null) return null;
  const finalStage = template.stages[template.stages.length - 1];
  if (!finalStage) return null;
  const done = stageQuantity(
    finalStage,
    batch.stage_entries.filter((e) => e.stage_id === finalStage.id),
  );
  const remaining = Math.max(0, round2(batch.lot_size - done));
  return (
    <Card title="Lot summary" subtitle={`Final stage: ${finalStage.name}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Lot size</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-800">{batch.lot_size}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-green-600">Completed</div>
          <div className="mt-0.5 text-2xl font-bold text-green-700">{round2(done)}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-red-600">Remaining</div>
          <div className="mt-0.5 text-2xl font-bold text-red-700">{remaining}</div>
        </div>
      </div>
    </Card>
  );
}

/** A compact clickable tile in the lot setup bar. */
function SetupTile({
  label,
  value,
  muted,
  onClick,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-brand hover:bg-brand-50"
    >
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
        <div
          className={cn(
            "truncate text-sm font-semibold",
            muted ? "text-slate-400" : "text-slate-800",
          )}
        >
          {value}
        </div>
      </div>
      <Pencil className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function LotSizeBody({
  batchId,
  lotSize,
  canEnter,
  onClose,
  onChanged,
}: {
  batchId: number;
  lotSize: number | null;
  canEnter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [val, setVal] = useState(lotSize != null ? String(lotSize) : "");

  const saveMut = useMutation({
    mutationFn: () => updateBatch(batchId, { lot_size: val.trim() !== "" ? Number(val) : null }),
    onSuccess: () => {
      toast.success("Lot size saved");
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!canEnter) {
    return (
      <p className="text-sm text-slate-700">
        {lotSize != null ? (
          <>
            Target: <strong>{lotSize}</strong>
          </>
        ) : (
          <span className="text-slate-400">Not set.</span>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Total quantity" className="w-48">
        <Input
          type="number"
          step="any"
          min="0"
          autoFocus
          value={val}
          placeholder="e.g. 1000"
          onChange={(e) => setVal(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Save lot size
        </Button>
      </div>
    </div>
  );
}

function MachineEntriesTable({
  entries,
  stageFields,
  machineName,
  canEnter,
  canEditEntry,
  onEdit,
  onDelete,
}: {
  entries: StageEntry[];
  stageFields: FieldDef[];
  machineName: (mid: number) => string;
  canEnter: boolean;
  canEditEntry: (e: StageEntry) => boolean;
  onEdit: (entryId: number) => void;
  onDelete: (entryId: number) => void;
}) {
  const total = entries.reduce(
    (sum, e) => sum + e.machine_entries.reduce((s, me) => s + (me.quantity ?? 0), 0),
    0,
  );
  const th = "px-3 py-2 font-semibold";
  const td = "px-3 py-2 align-top";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className={th}>Design</th>
            <th className={th}>Color</th>
            <th className={th}>Machine</th>
            <th className={th}>Quantity</th>
            {stageFields.map((f) => (
              <th key={f.id} className={th}>
                {f.label}
              </th>
            ))}
            <th className={th}>Added by</th>
            <th className={th}>Date</th>
            {canEnter && <th className={th} />}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 last:border-0">
              <td className={td}>{e.design_name ?? <span className="text-slate-400">—</span>}</td>
              <td className={td}>
                {e.color_name ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300"
                      style={{ background: e.color_hex ?? "transparent" }}
                    />
                    {e.color_name}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className={td}>
                {e.machine_entries.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <div className="space-y-1">
                    {e.machine_entries.map((me) => (
                      <div key={me.id} className="font-medium text-slate-700">
                        {machineName(me.machine_id)}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className={td}>
                {e.machine_entries.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <div className="space-y-1">
                    {e.machine_entries.map((me) => (
                      <div key={me.id} className="text-slate-700">
                        {me.quantity ?? "—"}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              {stageFields.map((f) => (
                <td key={f.id} className={td}>
                  {fmt(e.data[f.key])}
                </td>
              ))}
              <td className={td}>{e.submitted_by_name ?? "—"}</td>
              <td className={`${td} text-slate-400`}>{new Date(e.updated_at).toLocaleString()}</td>
              {canEnter && (
                <td className={`${td} text-right`}>
                  {canEditEntry(e) && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(e.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(e.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-slate-800">
            <td className="px-3 py-2" colSpan={3}>
              Total quantity
            </td>
            <td className="px-3 py-2">{total}</td>
            <td className="px-3 py-2" colSpan={stageFields.length + (canEnter ? 3 : 2)} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MaterialsBody({
  batchId,
  materials,
  canEnter,
  onClose,
  onChanged,
}: {
  batchId: number;
  materials: BatchMaterial[];
  canEnter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: inventory } = useQuery({ queryKey: ["inventory"], queryFn: listInventory });

  const usedByBatch = new Map(materials.map((m) => [m.inventory_item_id, m.quantity]));
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(materials.map((m) => [m.inventory_item_id, String(m.quantity)])),
  );

  const saveMut = useMutation({
    mutationFn: () => {
      const items = Object.entries(qty)
        .map(([id, v]) => ({ inventory_item_id: Number(id), quantity: Number(v) }))
        .filter((m) => m.quantity > 0 && !Number.isNaN(m.quantity));
      return setBatchMaterials(batchId, items);
    },
    onSuccess: () => {
      toast.success("Materials saved");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Read-only view for viewers.
  if (!canEnter) {
    return materials.length === 0 ? (
      <p className="text-sm text-slate-400">No materials recorded.</p>
    ) : (
      <ul className="space-y-1 text-sm text-slate-700">
        {materials.map((m) => (
          <li key={m.inventory_item_id}>
            {m.name}: <strong>{m.quantity}</strong> {m.unit}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Material</th>
              <th className="px-4 py-2.5 font-semibold">In stock</th>
              <th className="px-4 py-2.5 font-semibold">Used by this lot</th>
            </tr>
          </thead>
          <tbody>
            {(inventory ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  No inventory items.
                </td>
              </tr>
            )}
            {(inventory ?? []).map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{item.name}</td>
                <td className="px-4 py-2 text-slate-500">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-4 py-2">
                  <Field>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      className="h-9 w-32"
                      value={qty[item.id] ?? ""}
                      placeholder={usedByBatch.has(item.id) ? String(usedByBatch.get(item.id)) : "0"}
                      onChange={(e) => setQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </Field>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Save materials
        </Button>
      </div>
    </div>
  );
}

/**
 * Designs available to this lot. Unlike the colour split there is no quantity —
 * it purely narrows the design picker during entry. Ticking nothing means
 * "no restriction", so every design stays selectable.
 */
function DesignsBody({
  batchId,
  selected,
  canEnter,
  onClose,
  onChanged,
}: {
  batchId: number;
  selected: BatchDesign[];
  canEnter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data: designs } = useQuery({ queryKey: ["designs"], queryFn: listDesigns });

  const [picked, setPicked] = useState<number[]>(() => selected.map((d) => d.design_id));
  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Client-side filter — the full design list is already loaded, so this is instant.
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const all = designs ?? [];
  const q = query.trim().toLowerCase();
  const visible = all.filter(
    (d) =>
      (!selectedOnly || picked.includes(d.id)) &&
      (!q ||
        d.name.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q)),
  );
  // Ticking something and then searching past it shouldn't feel like it was lost.
  const hiddenPicked = picked.filter((id) => !visible.some((d) => d.id === id)).length;

  const saveMut = useMutation({
    mutationFn: () => setBatchDesigns(batchId, picked),
    onSuccess: () => {
      toast.success(picked.length ? "Lot designs saved" : "Design restriction cleared");
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Read-only view for viewers.
  if (!canEnter) {
    return selected.length === 0 ? (
      <p className="text-sm text-slate-400">No designs attached — all designs are available.</p>
    ) : (
      <ul className="space-y-1 text-sm text-slate-700">
        {selected.map((d) => (
          <li key={d.design_id}>{d.name}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {all.length === 0 ? (
        <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No designs defined. Add designs on the Design page first.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search designs…"
                aria-label="Search designs"
                className="pl-9 pr-9"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {picked.length > 0 && (
              <Button
                variant={selectedOnly ? "primary" : "secondary"}
                onClick={() => setSelectedOnly((v) => !v)}
              >
                Selected ({picked.length})
              </Button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              {q ? `No designs match “${query}”.` : "Nothing selected yet."}
            </p>
          ) : (
            <div className="grid max-h-[45vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {visible.map((d) => (
                <label
                  key={d.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    picked.includes(d.id)
                      ? "border-brand bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{d.name}</span>
                    {d.description && (
                      <span className="block truncate text-xs text-slate-400">{d.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {(q || selectedOnly) && (
            <p className="text-xs text-slate-400">
              Showing {visible.length} of {all.length} designs
              {hiddenPicked > 0 && ` · ${hiddenPicked} selected hidden by this filter`}
            </p>
          )}
        </>
      )}

      <p className="text-sm text-slate-500">
        {picked.length === 0 ? (
          <>
            Nothing selected — operators can pick <strong className="text-slate-700">any design</strong>.
          </>
        ) : (
          <>
            Operators will only see these{" "}
            <strong className="text-slate-700">{picked.length}</strong> design
            {picked.length === 1 ? "" : "s"}.
          </>
        )}
      </p>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        {picked.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setPicked([]);
              setSelectedOnly(false); // otherwise the list would filter down to nothing
            }}
          >
            Clear all
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Save designs
        </Button>
      </div>
    </div>
  );
}

function ColorSplitBody({
  batchId,
  lotSize,
  targets,
  canEnter,
  onClose,
  onChanged,
}: {
  batchId: number;
  lotSize: number | null;
  targets: BatchColorTarget[];
  canEnter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data: colors } = useQuery({ queryKey: ["colors"], queryFn: listColors });

  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(targets.map((t) => [t.color_id, String(t.quantity)])),
  );

  const saveMut = useMutation({
    mutationFn: () => {
      const items = Object.entries(qty)
        .map(([id, v]) => ({ color_id: Number(id), quantity: Number(v) }))
        .filter((t) => t.quantity > 0 && !Number.isNaN(t.quantity));
      return setBatchColorTargets(batchId, items);
    },
    onSuccess: () => {
      toast.success("Color split saved");
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const splitTotal = round2(
    Object.values(qty).reduce((s, v) => {
      const n = Number(v);
      return s + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0),
  );
  const overBy = lotSize != null ? round2(splitTotal - lotSize) : null;

  // Read-only view for viewers.
  if (!canEnter) {
    return targets.length === 0 ? (
      <p className="text-sm text-slate-400">No color split set.</p>
    ) : (
      <ul className="space-y-1 text-sm text-slate-700">
        {targets.map((t) => (
          <li key={t.color_id} className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300"
              style={{ background: t.hex ?? "transparent" }}
            />
            {t.name}: <strong>{t.quantity}</strong>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Color</th>
              <th className="px-4 py-2.5 font-semibold">Planned quantity</th>
            </tr>
          </thead>
          <tbody>
            {(colors ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  No colors defined. Add colors on the Design page first.
                </td>
              </tr>
            )}
            {(colors ?? []).map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300"
                      style={{ background: c.hex ?? "transparent" }}
                    />
                    {c.name}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Field>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      className="h-9 w-32"
                      value={qty[c.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setQty((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  </Field>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        Split total: <strong className="text-slate-700">{splitTotal}</strong>
        {lotSize != null && (
          <>
            {" "}
            of lot size <strong className="text-slate-700">{lotSize}</strong>
            {overBy != null && overBy > 0 && (
              <span className="text-red-600"> · exceeds lot size by {overBy}</span>
            )}
          </>
        )}
      </p>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          Save color split
        </Button>
      </div>
    </div>
  );
}

function StatsModal({
  open,
  onClose,
  template,
  batch,
}: {
  open: boolean;
  onClose: () => void;
  template: TemplateRead;
  batch: BatchRead;
}) {
  const colorDefs = batch.color_targets;

  const rows = template.stages.map((stage) => {
    const entries = batch.stage_entries.filter((e) => e.stage_id === stage.id);
    const byColor = perColorAtStage(stage, entries);
    const cells = colorDefs.map((c) => round2(byColor.get(c.color_id) ?? 0));
    return { stage, cells, total: round2(cells.reduce((s, v) => s + v, 0)) };
  });

  const chartData = rows.map((r) => {
    const row: Record<string, number | string> = { stage: r.stage.name };
    colorDefs.forEach((c, i) => (row[c.name] = r.cells[i]));
    return row;
  });

  const th = "px-3 py-2 font-semibold";
  const td = "px-3 py-2 align-top";

  return (
    <Modal open={open} onClose={onClose} title={`Color-wise statistics — ${batch.code}`} size="lg">
      {colorDefs.length === 0 ? (
        <p className="text-sm text-slate-400">Add a color split to see statistics.</p>
      ) : (
        <div className="space-y-5">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="stage" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Legend />
                {colorDefs.map((c) => (
                  <Bar key={c.color_id} dataKey={c.name} stackId="a" fill={c.hex ?? NO_COLOR} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className={th}>Stage</th>
                  {colorDefs.map((c) => (
                    <th key={c.color_id} className={th}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-slate-300"
                          style={{ background: c.hex ?? NO_COLOR }}
                        />
                        {c.name}
                      </span>
                    </th>
                  ))}
                  <th className={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 text-slate-500">
                  <td className={`${td} font-medium`}>Planned (lot)</td>
                  {colorDefs.map((c) => (
                    <td key={c.color_id} className={td}>
                      {c.quantity}
                    </td>
                  ))}
                  <td className={td}>{round2(colorDefs.reduce((s, c) => s + c.quantity, 0))}</td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.stage.id} className="border-b border-slate-100 last:border-0">
                    <td className={`${td} font-medium text-slate-700`}>{r.stage.name}</td>
                    {r.cells.map((v, i) => (
                      <td key={colorDefs[i].color_id} className={td}>
                        {v}
                      </td>
                    ))}
                    <td className={`${td} font-semibold text-slate-800`}>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function StageCard({
  batchId,
  stage,
  machines,
  entries,
  lotSize,
  colorTargets,
  lotDesigns,
  isCurrent,
  canEnter,
  isAdmin,
  currentUserId,
  onChanged,
}: {
  batchId: number;
  stage: Stage;
  machines: Machine[];
  entries: StageEntry[];
  lotSize: number | null;
  colorTargets: BatchColorTarget[];
  lotDesigns: BatchDesign[];
  isCurrent: boolean;
  canEnter: boolean;
  isAdmin: boolean;
  currentUserId: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [listOpen, setListOpen] = useState(false);
  const [form, setForm] = useState<"add" | number | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const stageFields = stage.field_defs.filter((f) => f.scope === "stage");
  const done = stageQuantity(stage, entries);
  const canEditEntry = (e: StageEntry) => isAdmin || e.submitted_by === currentUserId;
  const machineName = (mid: number) => machines.find((m) => m.id === mid)?.name ?? `#${mid}`;

  const colorTargetIds = colorTargets.map((t) => t.color_id);
  const lotDesignIds = lotDesigns.map((d) => d.design_id);
  // The fast multi-colour grid fits simple machine stages (machines, no custom
  // per-machine input/output fields). Everything else uses the single-entry form.
  const hasRichMachineFields = stage.field_defs.some(
    (f) => f.scope === "machine_input" || f.scope === "machine_output",
  );
  const useGrid = stage.has_machines && !hasRichMachineFields;

  const doneByColorId: Record<number, number> = {};
  perColorAtStage(stage, entries).forEach((v, cid) => {
    if (cid != null) doneByColorId[cid] = v;
  });
  const lastDesignId =
    [...entries].reverse().find((e) => e.design_id != null)?.design_id ?? null;

  const handleErr = (e: unknown) => {
    const v = apiValidationErrors(e);
    if (v) setErrors(v);
    else toast.error(apiErrorMessage(e));
  };

  const createMut = useMutation({
    mutationFn: (v: { payload: StageEntrySubmit; addAnother?: boolean }) =>
      createStageEntry(batchId, stage.id, v.payload),
    onSuccess: (_created, v) => {
      setErrors([]);
      setFormKey((k) => k + 1);
      // "Save & add another" keeps the form open with a fresh (reset) form.
      if (!v.addAnother) setForm(null);
      toast.success("Entry added");
      onChanged();
    },
    onError: handleErr,
  });

  const updateMut = useMutation({
    mutationFn: (v: { entryId: number; payload: StageEntrySubmit }) =>
      updateStageEntry(batchId, v.entryId, v.payload),
    onSuccess: () => {
      setErrors([]);
      setForm(null);
      toast.success("Entry updated");
      onChanged();
    },
    onError: handleErr,
  });

  const bulkMut = useMutation({
    mutationFn: (payloads: StageEntrySubmit[]) => createStageEntriesBulk(batchId, stage.id, payloads),
    onSuccess: (created) => {
      setErrors([]);
      setGridOpen(false);
      setFormKey((k) => k + 1);
      toast.success(`${created.length} ${created.length === 1 ? "entry" : "entries"} added`);
      onChanged();
    },
    onError: handleErr,
  });

  const deleteMut = useMutation({
    mutationFn: (entryId: number) => deleteStageEntry(batchId, entryId),
    onSuccess: () => {
      setPendingDeleteId(null);
      if (entries.length <= 1) setListOpen(false);
      toast.success("Entry deleted");
      onChanged();
    },
    onError: (e) => {
      setPendingDeleteId(null);
      toast.error(apiErrorMessage(e));
    },
  });

  const openAdd = () => {
    setErrors([]);
    if (useGrid) {
      setFormKey((k) => k + 1);
      setGridOpen(true);
    } else {
      setForm("add");
    }
  };
  const openEdit = (entryId: number) => {
    setErrors([]);
    setListOpen(false);
    setForm(entryId);
  };
  const closeForm = () => {
    setForm(null);
    setErrors([]);
  };
  const closeGrid = () => {
    setGridOpen(false);
    setErrors([]);
  };

  const editing = typeof form === "number" ? entries.find((e) => e.id === form) : undefined;

  const columns: Column<StageEntry>[] = [
    {
      header: "Design",
      cell: (e) => (e.design_name ? <span className="text-slate-700">{e.design_name}</span> : <span className="text-slate-400">—</span>),
    },
    {
      header: "Color",
      cell: (e) =>
        e.color_name ? (
          <span className="flex items-center gap-1.5 text-slate-700">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300"
              style={{ background: e.color_hex ?? "transparent" }}
            />
            {e.color_name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    ...stageFields.map(
      (f): Column<StageEntry> => ({ header: f.label, cell: (e) => fmt(e.data[f.key]) }),
    ),
    { header: "Added by", cell: (e) => e.submitted_by_name ?? "—" },
    {
      header: "Updated",
      cell: (e) => <span className="text-slate-400">{new Date(e.updated_at).toLocaleString()}</span>,
    },
    {
      header: "",
      align: "right",
      cell: (e) =>
        canEnter && canEditEntry(e) ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(e.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(e.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <Card className={isCurrent ? "ring-1 ring-brand/40" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            {stage.order_index + 1}. {stage.name}
            <Badge tone={entries.length ? "indigo" : "gray"}>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </Badge>
          </h2>
          <QtyCounts done={done} lotSize={lotSize} />
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setListOpen(true)}>
              View entries
            </Button>
          )}
          {canEnter && (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add
            </Button>
          )}
        </div>
      </div>

      {!canEnter && entries.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">No entries.</p>
      )}

      <Modal open={listOpen} onClose={() => setListOpen(false)} title={`Entries — ${stage.name}`} size="lg">
        {stage.has_machines ? (
          <MachineEntriesTable
            entries={entries}
            stageFields={stageFields}
            machineName={machineName}
            canEnter={canEnter}
            canEditEntry={canEditEntry}
            onEdit={openEdit}
            onDelete={setPendingDeleteId}
          />
        ) : (
          <DataTable columns={columns} data={entries} rowKey={(e) => e.id} />
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId !== null && deleteMut.mutate(pendingDeleteId)}
      />

      <Modal
        open={gridOpen}
        onClose={closeGrid}
        title={`New entries — ${stage.name}`}
        description="Enter a quantity for each colour. One save records them all."
        size="md"
      >
        <MultiColorEntryForm
          key={formKey}
          stage={stage}
          machines={machines}
          colorTargets={colorTargets}
          doneByColorId={doneByColorId}
          lastDesignId={lastDesignId}
          allowedDesignIds={lotDesignIds}
          errors={errors}
          submitting={bulkMut.isPending}
          onSubmit={(payloads) => bulkMut.mutate(payloads)}
          onCancel={closeGrid}
        />
      </Modal>

      <Modal
        open={form !== null}
        onClose={closeForm}
        title={editing ? `Edit entry — ${stage.name}` : `New entry — ${stage.name}`}
        description={editing ? `Originally added by ${editing.submitted_by_name ?? "—"}` : undefined}
      >
        {editing ? (
          <StageEntryForm
            stage={stage}
            machines={machines}
            existing={editing}
            errors={errors}
            canEdit
            submitting={updateMut.isPending}
            allowedColorIds={colorTargetIds}
            allowedDesignIds={lotDesignIds}
            onSubmit={(payload) => updateMut.mutate({ entryId: editing.id, payload })}
            onCancel={closeForm}
          />
        ) : (
          <StageEntryForm
            key={formKey}
            stage={stage}
            machines={machines}
            errors={errors}
            canEdit
            submitting={createMut.isPending}
            allowedColorIds={colorTargetIds}
            allowedDesignIds={lotDesignIds}
            allowAddAnother
            onSubmit={(payload, addAnother) => createMut.mutate({ payload, addAnother })}
            onCancel={closeForm}
          />
        )}
      </Modal>
    </Card>
  );
}
