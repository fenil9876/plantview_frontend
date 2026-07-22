import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { apiErrorMessage, apiValidationErrors } from "../lib/api";
import {
  createStageEntriesBulk,
  createStageEntry,
  deleteStageEntry,
  getBatch,
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
  ErrorBanner,
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

  const [setup, setSetup] = useState<null | "lot" | "designs" | "materials">(null);

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
        title={<span className="font-mono">{batch.code}</span>}
        backTo="/batches"
        backLabel="Batches"
        subtitle={
          <>
            {template.name} · current stage: <strong>{stageName(batch.current_stage_id)}</strong>
          </>
        }
        actions={
          <>
            <Link to={`/batches/${batchId}/analytics`}>
              <Button
                variant="secondary"
                leftIcon={<BarChart3 className="h-4 w-4" />}
                title="Bottlenecks, per design/colour progress and flow over time"
              >
                Analytics
              </Button>
            </Link>
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SetupTile
            label="Lot size"
            value={batch.lot_size != null ? String(batch.lot_size) : "Not set"}
            muted={batch.lot_size == null}
            onClick={() => setSetup("lot")}
          />
          <SetupTile
            label="Designs & colors"
            value={
              batch.designs.length
                ? `${batch.designs.length} design${batch.designs.length === 1 ? "" : "s"} · ` +
                  `${batch.color_targets.length} color${batch.color_targets.length === 1 ? "" : "s"}`
                : "All"
            }
            muted={batch.designs.length === 0}
            onClick={() => setSetup("designs")}
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
        title="Designs & colors"
        description="Add each design this lot runs, then the colours it runs in. Operators only see a design's own colours when entering data. Add nothing to leave every design and colour available."
        size="lg"
      >
        <DesignsColorsBody
          batchId={batchId}
          lotSize={batch.lot_size}
          selected={batch.designs}
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

      {template.stages.map((stage) => (
        <StageCard
          key={stage.id}
          batchId={batchId}
          stage={stage}
          machines={machines ?? []}
          entries={batch.stage_entries.filter((e) => e.stage_id === stage.id)}
          lotSize={batch.lot_size}
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
          <div className="text-xs uppercase tracking-wide text-slate-500">Lot size</div>
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
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div
          className={cn(
            "truncate text-sm font-semibold",
            muted ? "text-slate-500" : "text-slate-800",
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
          <span className="text-slate-500">Not set.</span>
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
    <>
      {/* ---- Mobile: one card per entry ----
          This table is as wide as the stage has columns, so on a phone it would
          be a sideways scroll through the very numbers people opened it to
          check. Each entry becomes a card instead. */}
      <div className="space-y-2.5 md:hidden">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {e.color_name && (
                  <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300"
                      style={{ background: e.color_hex ?? "transparent" }}
                    />
                    {e.color_name}
                  </span>
                )}
                {e.design_name && <span className="text-sm text-slate-600">{e.design_name}</span>}
                {!e.color_name && !e.design_name && (
                  <span className="font-semibold text-slate-900">Entry</span>
                )}
              </div>
              {canEnter && canEditEntry(e) && (
                <div className="-mr-2 -mt-2 flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => onEdit(e.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => onDelete(e.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>

            {e.machine_entries.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {e.machine_entries.map((me) => (
                  <div key={me.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-600">{machineName(me.machine_id)}</span>
                    <span className="tabular font-semibold text-slate-900">{me.quantity ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {stageFields.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                {stageFields.map((f) => (
                  <span key={f.id}>
                    <span className="text-slate-500">{f.label}:</span> {fmt(e.data[f.key])}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 text-xs text-slate-500">
              {e.submitted_by_name ?? "—"} · {new Date(e.updated_at).toLocaleString()}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-800">
          <span>Total quantity</span>
          <span className="tabular">{total}</span>
        </div>
      </div>

      {/* ---- Desktop: full table ---- */}
      <div className="hidden overflow-x-auto md:block">
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
              <td className={td}>{e.design_name ?? <span className="text-slate-500">—</span>}</td>
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
                  <span className="text-slate-500">—</span>
                )}
              </td>
              <td className={td}>
                {e.machine_entries.length === 0 ? (
                  <span className="text-slate-500">—</span>
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
                  <span className="text-slate-500">—</span>
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
              <td className={`${td} text-slate-500`}>{new Date(e.updated_at).toLocaleString()}</td>
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
    </>
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
      <p className="text-sm text-slate-500">No materials recorded.</p>
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
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
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
                  {/* `Input` is always w-full, so the width lives on a wrapper. */}
                  <div className="w-28">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      className="h-10"
                      value={qty[item.id] ?? ""}
                      placeholder={usedByBatch.has(item.id) ? String(usedByBatch.get(item.id)) : "0"}
                      onChange={(e) => setQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>
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

/** color_id → planned quantity as typed; "" means "runs in this colour, no target". */
type ColorDraft = Record<number, string>;
interface DesignDraft {
  design_id: number;
  colors: ColorDraft;
}

const draftTotal = (colors: ColorDraft) =>
  round2(
    Object.values(colors).reduce((s, v) => {
      const n = Number(v);
      return s + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0),
  );

/**
 * The designs this lot runs and the colours under each. Colours belong to a
 * design, not the lot, so D1 can run red+blue while D2 runs black only — that
 * pairing is what the entry form offers operators. Attaching no design at all
 * means "no restriction": every design and colour stays selectable.
 */
function DesignsColorsBody({
  batchId,
  lotSize,
  selected,
  canEnter,
  onClose,
  onChanged,
}: {
  batchId: number;
  lotSize: number | null;
  selected: BatchDesign[];
  canEnter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data: designs } = useQuery({ queryKey: ["designs"], queryFn: listDesigns });
  const { data: colors } = useQuery({ queryKey: ["colors"], queryFn: listColors });

  const [drafts, setDrafts] = useState<DesignDraft[]>(() =>
    selected.map((d) => ({
      design_id: d.design_id,
      colors: Object.fromEntries(
        d.colors.map((c) => [c.color_id, c.quantity != null ? String(c.quantity) : ""]),
      ),
    })),
  );
  // One design open at a time keeps the modal short enough to use on a phone.
  const [openId, setOpenId] = useState<number | null>(selected[0]?.design_id ?? null);
  const [query, setQuery] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const allDesigns = designs ?? [];
  const allColors = colors ?? [];
  const designName = (id: number) => allDesigns.find((d) => d.id === id)?.name ?? `#${id}`;

  const q = query.trim().toLowerCase();
  const addable = allDesigns.filter(
    (d) =>
      !drafts.some((x) => x.design_id === d.id) &&
      (!q || d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)),
  );

  const addDesign = (id: number) => {
    setDrafts((prev) => [...prev, { design_id: id, colors: {} }]);
    setOpenId(id); // straight into picking its colours — that's the required next step
    setQuery("");
  };
  const removeDesign = (id: number) => {
    setDrafts((prev) => prev.filter((d) => d.design_id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };
  const toggleColor = (designId: number, colorId: number) =>
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.design_id !== designId) return d;
        const next = { ...d.colors };
        if (colorId in next) delete next[colorId];
        else next[colorId] = "";
        return { ...d, colors: next };
      }),
    );
  const setColorQty = (designId: number, colorId: number, v: string) =>
    setDrafts((prev) =>
      prev.map((d) =>
        d.design_id === designId ? { ...d, colors: { ...d.colors, [colorId]: v } } : d,
      ),
    );

  const plannedTotal = round2(drafts.reduce((s, d) => s + draftTotal(d.colors), 0));
  const overBy = lotSize != null ? round2(plannedTotal - lotSize) : null;

  const saveMut = useMutation({
    mutationFn: () =>
      setBatchDesigns(
        batchId,
        drafts.map((d) => ({
          design_id: d.design_id,
          colors: Object.entries(d.colors).map(([cid, v]) => ({
            color_id: Number(cid),
            quantity: v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null,
          })),
        })),
      ),
    onSuccess: () => {
      toast.success(drafts.length ? "Designs & colours saved" : "Restriction cleared");
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const save = () => {
    // Every design must bring at least one colour — the entry form has nothing
    // to offer an operator otherwise.
    const empty = drafts.filter((d) => Object.keys(d.colors).length === 0);
    if (empty.length) {
      setLocalError(
        `Add at least one colour to: ${empty.map((d) => designName(d.design_id)).join(", ")}.`,
      );
      setOpenId(empty[0].design_id);
      return;
    }
    setLocalError(null);
    saveMut.mutate();
  };

  // Read-only view for viewers.
  if (!canEnter) {
    return selected.length === 0 ? (
      <p className="text-sm text-slate-500">
        No designs attached — all designs and colours are available.
      </p>
    ) : (
      <ul className="space-y-3 text-sm">
        {selected.map((d) => (
          <li key={d.design_id}>
            <div className="font-semibold text-slate-800">{d.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {d.colors.map((c) => (
                <span
                  key={c.color_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-slate-300"
                    style={{ background: c.hex ?? "transparent" }}
                  />
                  {c.name}
                  {c.quantity != null && <strong className="text-slate-800">{c.quantity}</strong>}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (allDesigns.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No designs defined. Add designs on the Design page first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {localError && <ErrorBanner message={localError} />}

      {/* Designs already in the lot, each expanding to its colours */}
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No design added yet — operators can pick any design and colour.
        </p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => {
            const open = openId === d.design_id;
            const count = Object.keys(d.colors).length;
            const total = draftTotal(d.colors);
            return (
              <div
                key={d.design_id}
                className={cn(
                  "overflow-hidden rounded-xl border transition-colors",
                  count === 0 ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.design_id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">
                        {designName(d.design_id)}
                      </span>
                      <span
                        className={cn(
                          "block text-xs",
                          count === 0 ? "text-amber-600" : "text-slate-500",
                        )}
                      >
                        {count === 0
                          ? "Pick its colours"
                          : `${count} colour${count === 1 ? "" : "s"}${total > 0 ? ` · planned ${total}` : ""}`}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${designName(d.design_id)}`}
                    onClick={() => removeDesign(d.design_id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {open && (
                  <div className="border-t border-slate-100 px-3 py-3">
                    {allColors.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No colours defined. Add colours on the Design page first.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {allColors.map((c) => {
                          const on = c.id in d.colors;
                          return (
                            <div
                              key={c.id}
                              className={cn(
                                "overflow-hidden rounded-lg border transition-colors",
                                on ? "border-brand bg-brand-50" : "border-slate-200",
                              )}
                            >
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleColor(d.design_id, c.id)}
                                className="flex min-h-[48px] w-full items-center gap-2.5 px-3 py-2.5 text-left"
                              >
                                <span
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                    on ? "border-brand bg-brand text-white" : "border-slate-300",
                                  )}
                                >
                                  {on && <Check className="h-3.5 w-3.5" />}
                                </span>
                                <span
                                  className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300"
                                  style={{ background: c.hex ?? "transparent" }}
                                />
                                <span className="truncate text-sm font-medium text-slate-800">
                                  {c.name}
                                </span>
                              </button>
                              {/* The quantity gets its own row. Sharing a line with the
                                  name overflowed on a phone, and `Input` is always
                                  `w-full`, so a width class on it cannot win. */}
                              {on && (
                                <label className="flex items-center gap-3 border-t border-brand/20 px-3 py-2.5">
                                  <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                                    Planned qty
                                  </span>
                                  {/* w-24 keeps label + field on one line down to 320px. */}
                                  <span className="ml-auto block w-24 shrink-0 sm:w-28">
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      step="any"
                                      min="0"
                                      aria-label={`Planned quantity for ${c.name}`}
                                      className="h-10 text-base"
                                      placeholder="—"
                                      value={d.colors[c.id]}
                                      onChange={(e) => setColorQty(d.design_id, c.id, e.target.value)}
                                    />
                                  </span>
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Quantity is the planned target and can be left blank.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add another design */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add a design
        </div>
        {allDesigns.length > 6 && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search designs…"
              aria-label="Search designs"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {addable.length === 0 ? (
          <p className="text-sm text-slate-500">
            {q ? `No designs match “${query}”.` : "Every design is already added."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {addable.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => addDesign(d.id)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand hover:bg-brand-50 hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {drafts.length === 0 ? (
          <>
            Nothing added — operators can pick{" "}
            <strong className="text-slate-700">any design and colour</strong>.
          </>
        ) : (
          <>
            Planned total <strong className="text-slate-700">{plannedTotal}</strong>
            {lotSize != null && (
              <>
                {" "}
                of lot size <strong className="text-slate-700">{lotSize}</strong>
                {overBy != null && overBy > 0 && (
                  <span className="text-red-600"> · exceeds lot size by {overBy}</span>
                )}
              </>
            )}
          </>
        )}
      </p>

      {/* Sticky so Save stays reachable once a few designs are expanded. */}
      <div className="sticky bottom-0 -mx-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-6 pb-1 pt-3">
        {drafts.length > 0 && (
          <Button variant="ghost" className="mr-auto" onClick={() => setDrafts([])}>
            Clear all
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saveMut.isPending} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function StageCard({
  batchId,
  stage,
  machines,
  entries,
  lotSize,
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
      cell: (e) => (e.design_name ? <span className="text-slate-700">{e.design_name}</span> : <span className="text-slate-500">—</span>),
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
          <span className="text-slate-500">—</span>
        ),
    },
    ...stageFields.map(
      (f): Column<StageEntry> => ({ header: f.label, cell: (e) => fmt(e.data[f.key]) }),
    ),
    { header: "Added by", cell: (e) => e.submitted_by_name ?? "—" },
    {
      header: "Updated",
      cell: (e) => <span className="text-slate-500">{new Date(e.updated_at).toLocaleString()}</span>,
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
    // The stage in progress is the one an operator scrolls to find, so it gets
    // a ring strong enough to spot without reading.
    <Card className={isCurrent ? "ring-2 ring-brand/40" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isCurrent ? "bg-brand text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {stage.order_index + 1}
            </span>
            <span className="min-w-0 truncate">{stage.name}</span>
          </h2>
          {isCurrent && <Badge tone="teal" dot>Current</Badge>}
          <Badge tone={entries.length ? "indigo" : "gray"}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </Badge>
          <QtyCounts done={done} lotSize={lotSize} />
        </div>
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          {entries.length > 0 && (
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => setListOpen(true)}
            >
              View entries
            </Button>
          )}
          {canEnter && (
            <Button
              className="flex-1 sm:flex-none"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={openAdd}
            >
              Add entry
            </Button>
          )}
        </div>
      </div>

      {!canEnter && entries.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">No entries.</p>
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
        description="Pick your machines and design, then a quantity per colour. One save records them all."
        size="md"
      >
        <MultiColorEntryForm
          key={formKey}
          stage={stage}
          machines={machines}
          lotDesigns={lotDesigns}
          doneByColorId={doneByColorId}
          lastDesignId={lastDesignId}
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
            lotDesigns={lotDesigns}
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
            lotDesigns={lotDesigns}
            allowAddAnother
            onSubmit={(payload, addAnother) => createMut.mutate({ payload, addAnother })}
            onCancel={closeForm}
          />
        )}
      </Modal>
    </Card>
  );
}
