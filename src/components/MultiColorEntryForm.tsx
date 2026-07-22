import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type {
  BatchDesign,
  FieldDef,
  Machine,
  MachineEntrySubmit,
  Stage,
  StageEntrySubmit,
  ValidationFieldError,
} from "../lib/types";
import { listColors, listDesigns } from "../lib/designApi";
import { DynamicField, type FieldValue } from "./DynamicField";
import { Button, cn, ErrorBanner, Field, Input, Select } from "./ui";

type ValMap = Record<string, FieldValue>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Above this many designs the chips stop being tappable and become a dropdown. */
const CHIP_LIMIT = 8;

/** Drop empties; keep booleans as-is. Mirrors StageEntryForm.buildRecord. */
function buildRecord(fields: FieldDef[], vals: ValMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = vals[f.key];
    if (f.data_type === "bool") out[f.key] = v === true;
    else if (typeof v === "string" && v.trim() !== "") out[f.key] = v;
  }
  return out;
}

interface Option {
  id: number;
  name: string;
}
interface ColorRow {
  id: number;
  name: string;
  hex: string | null;
  planned: number | null;
}

interface Props {
  stage: Stage;
  machines: Machine[];
  /** The lot's designs with the colours under each. Empty ⇒ no restriction. */
  lotDesigns: BatchDesign[];
  /** Quantity already recorded at this stage per colour id, for the "left" hint. */
  doneByColorId: Record<number, number>;
  /** Design used on the most recent entry of this stage — the sticky default. */
  lastDesignId: number | null;
  errors: ValidationFieldError[];
  submitting: boolean;
  onSubmit: (entries: StageEntrySubmit[]) => void;
  onCancel: () => void;
}

/**
 * Fast data entry for simple machine stages. The operator picks the machines they
 * ran and the design they ran, then types a quantity per machine against each of
 * that design's colours. One save creates one entry per colour, each grouping that
 * colour's machines. A single save covers one design — that is what keeps the
 * colour list unambiguous.
 */
export function MultiColorEntryForm({
  stage,
  machines,
  lotDesigns,
  doneByColorId,
  lastDesignId,
  errors,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const stageFields = stage.field_defs.filter((f) => f.scope === "stage");
  const assigned = stage.machine_ids
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is Machine => !!m);

  const restricted = lotDesigns.length > 0;
  // Only fetch the full lists when the lot hasn't narrowed things down for us.
  const { data: allDesigns } = useQuery({
    queryKey: ["designs"],
    queryFn: listDesigns,
    enabled: !restricted,
  });
  const { data: allColors } = useQuery({ queryKey: ["colors"], queryFn: listColors });

  const designOptions: Option[] = useMemo(
    () =>
      restricted
        ? lotDesigns.map((d) => ({ id: d.design_id, name: d.name }))
        : (allDesigns ?? []).map((d) => ({ id: d.id, name: d.name })),
    [restricted, lotDesigns, allDesigns],
  );

  // Stick to the design used last, so a repeat entry is one tap. With a single
  // option there is nothing to choose — pick it outright.
  const [designId, setDesignId] = useState<number | "">(() => {
    if (lastDesignId != null && designOptions.some((d) => d.id === lastDesignId)) return lastDesignId;
    return designOptions.length === 1 ? designOptions[0].id : "";
  });

  // Colours follow the chosen design; an unrestricted lot offers all of them.
  const rows: ColorRow[] = useMemo(() => {
    if (restricted) {
      if (designId === "") return [];
      const lot = lotDesigns.find((d) => d.design_id === designId);
      if (!lot) return [];
      return lot.colors.map((c) => ({
        id: c.color_id,
        name: c.name,
        hex: c.hex,
        planned: c.quantity,
      }));
    }
    return (allColors ?? []).map((c) => ({ id: c.id, name: c.name, hex: c.hex, planned: null }));
  }, [restricted, lotDesigns, designId, allColors]);

  // With just one or two machines there's nothing to gain from hiding any, so
  // pre-select them all; otherwise start empty and let the operator tap.
  const [selectedIds, setSelectedIds] = useState<number[]>(
    assigned.length <= 2 ? assigned.map((m) => m.id) : [],
  );
  // qty[colourId][machineId] = raw string
  const [qty, setQty] = useState<Record<number, Record<number, string>>>({});
  const [stageVals, setStageVals] = useState<ValMap>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const submittedOrder = useRef<number[]>([]);

  const requireDesign = stage.requires_design_color;
  const selectedMachines = assigned.filter((m) => selectedIds.includes(m.id));

  const toggleMachine = (mid: number) =>
    setSelectedIds((prev) => (prev.includes(mid) ? prev.filter((x) => x !== mid) : [...prev, mid]));

  // Switching design swaps the whole colour list, so anything already typed
  // belongs to the old design and would be silently mis-filed. Start clean.
  const chooseDesign = (val: number | "") => {
    setDesignId(val);
    setQty({});
    setLocalError(null);
  };

  const cell = (cid: number, mid: number): string => qty[cid]?.[mid] ?? "";
  const setCell = (cid: number, mid: number, val: string) =>
    setQty((prev) => ({ ...prev, [cid]: { ...(prev[cid] ?? {}), [mid]: val } }));

  /** Machine entries for a colour: only selected machines with a positive quantity. */
  const machinesForColor = (cid: number): MachineEntrySubmit[] =>
    selectedMachines
      .map((m) => ({ m, raw: cell(cid, m.id).trim() }))
      .filter((x) => x.raw !== "" && Number(x.raw) > 0 && !Number.isNaN(Number(x.raw)))
      .map((x) => ({
        machine_id: x.m.id,
        input_data: {},
        output_data: {},
        quantity: Number(x.raw),
        description: null,
      }));

  // Map server (bulk) errors back to colour rows via the submitted order.
  const rowErrors = new Map<number, string[]>();
  const generalErrors: string[] = [];
  for (const e of errors) {
    const cid = e.index != null ? submittedOrder.current[e.index] : undefined;
    const label =
      e.field === "entry" || e.field === "color" || e.field === "design"
        ? e.error
        : `${e.field}: ${e.error}`;
    if (cid != null) rowErrors.set(cid, [...(rowErrors.get(cid) ?? []), label]);
    else generalErrors.push(label);
  }

  const filledRows = rows.filter((r) => machinesForColor(r.id).length > 0);
  const machineEntryCount = filledRows.reduce((s, r) => s + machinesForColor(r.id).length, 0);
  const total = round2(
    filledRows.reduce(
      (s, r) => s + machinesForColor(r.id).reduce((a, me) => a + (me.quantity ?? 0), 0),
      0,
    ),
  );

  const submit = () => {
    if (stage.has_machines && selectedMachines.length === 0) {
      setLocalError("Tap the machine(s) you ran first.");
      return;
    }
    if (requireDesign && designId === "") {
      setLocalError("Choose the design you ran.");
      return;
    }
    if (filledRows.length === 0) {
      setLocalError("Enter a quantity for at least one machine.");
      return;
    }
    setLocalError(null);

    const data = buildRecord(stageFields, stageVals);
    submittedOrder.current = filledRows.map((r) => r.id);
    const entries: StageEntrySubmit[] = filledRows.map((r) => ({
      data,
      machines: machinesForColor(r.id),
      design_id: designId === "" ? null : designId,
      color_id: r.id,
    }));
    onSubmit(entries);
  };

  return (
    <div className="space-y-4">
      {generalErrors.length > 0 && <ErrorBanner message={generalErrors.join("; ")} />}
      {localError && <ErrorBanner message={localError} />}

      {stage.has_machines && (
        <Field label="Machines you ran" required>
          {assigned.length === 0 ? (
            <p className="text-sm text-slate-500">No machines assigned to this stage.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assigned.map((m) => {
                const on = selectedIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleMachine(m.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                      on
                        ? "border-brand bg-brand-50 text-brand-800"
                        : "border-slate-300 bg-white text-slate-600 hover:border-brand hover:bg-brand-50",
                    )}
                  >
                    {on && <Check className="h-4 w-4" />}
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}

      <Field
        label="Design you ran"
        required={requireDesign}
        hint="One design per save — the colours below are the ones it runs in."
      >
        {designOptions.length === 0 ? (
          <p className="text-sm text-slate-500">
            No designs available. Add designs to this lot under “Designs &amp; colors”.
          </p>
        ) : designOptions.length > CHIP_LIMIT ? (
          <Select
            value={designId}
            className="h-11 text-base"
            onChange={(e) => chooseDesign(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— choose a design —</option>
            {designOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex flex-wrap gap-2">
            {designOptions.map((d) => {
              const on = designId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => chooseDesign(on ? "" : d.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                    on
                      ? "border-brand bg-brand-50 text-brand-800"
                      : "border-slate-300 bg-white text-slate-600 hover:border-brand hover:bg-brand-50",
                  )}
                >
                  {on && <Check className="h-4 w-4" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {stageFields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stageFields.map((f) => (
            <DynamicField
              key={f.id}
              field={f}
              value={stageVals[f.key]}
              onChange={(v) => setStageVals((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">
          Enter each machine's quantity per colour
        </div>
        {restricted && designId === "" ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Choose a design above to see its colours.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            {restricted
              ? "This design has no colours in this lot. Add them under “Designs & colors”."
              : "No colours available. Add colours on the Design page."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const done = doneByColorId[r.id] ?? 0;
              const left = r.planned != null ? round2(r.planned - done) : null;
              const errs = rowErrors.get(r.id);
              return (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-300"
                        style={{ background: r.hex ?? "transparent" }}
                      />
                      {r.name}
                    </span>
                    {r.planned != null && (
                      <span className="text-xs text-slate-500">
                        planned {round2(r.planned)}
                        {left != null && (
                          <>
                            {" · "}
                            <span className={left <= 0 ? "text-green-600" : "text-slate-500"}>
                              {Math.max(0, left)} left
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {stage.has_machines &&
                    (selectedMachines.length === 0 ? (
                      <p className="mt-2.5 text-xs text-slate-500">
                        Tap the machine(s) you ran above to enter quantities.
                      </p>
                    ) : (
                      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {selectedMachines.map((m) => (
                          <Field key={m.id} label={m.name}>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              placeholder="0"
                              className="h-11 text-base"
                              value={cell(r.id, m.id)}
                              onChange={(e) => setCell(r.id, m.id, e.target.value)}
                            />
                          </Field>
                        ))}
                      </div>
                    ))}

                  {errs && <p className="mt-1.5 text-xs text-red-600">{errs.join("; ")}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Margins must match the modal's own padding, which is tighter on a
          phone than on desktop, or the bar overhangs its container. */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-100 bg-white px-4 pb-1 pt-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-0">
        <p className="text-sm text-slate-500">
          {filledRows.length} colour{filledRows.length === 1 ? "" : "s"} · {machineEntryCount} machine
          {machineEntryCount === 1 ? "" : "s"} · total <strong className="text-slate-700">{total}</strong>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={submit} loading={submitting}>
            Save all
          </Button>
        </div>
      </div>
    </div>
  );
}
