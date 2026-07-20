import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type {
  BatchColorTarget,
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

interface ColorRow {
  id: number;
  name: string;
  hex: string | null;
  planned: number | null;
}

interface Props {
  stage: Stage;
  machines: Machine[];
  /** The lot's colour split; drives the rows. Empty ⇒ fall back to all colours. */
  colorTargets: BatchColorTarget[];
  /** Quantity already recorded at this stage per colour id, for the "left" hint. */
  doneByColorId: Record<number, number>;
  /** Design used on the most recent entry of this stage — the sticky default. */
  lastDesignId: number | null;
  /** The lot's designs. Empty ⇒ no restriction (all designs selectable). */
  allowedDesignIds?: number[];
  errors: ValidationFieldError[];
  submitting: boolean;
  onSubmit: (entries: StageEntrySubmit[]) => void;
  onCancel: () => void;
}

/**
 * Fast data entry for simple machine stages. The operator first taps the machines
 * they ran, then types a quantity per machine on each colour. One save creates one
 * entry per colour (grouping that colour's machines). Design defaults to the last
 * one picked and carries to still-untouched rows.
 */
export function MultiColorEntryForm({
  stage,
  machines,
  colorTargets,
  doneByColorId,
  lastDesignId,
  allowedDesignIds,
  errors,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const stageFields = stage.field_defs.filter((f) => f.scope === "stage");
  const assigned = stage.machine_ids
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is Machine => !!m);

  const { data: designs } = useQuery({ queryKey: ["designs"], queryFn: listDesigns });
  const { data: allColors } = useQuery({ queryKey: ["colors"], queryFn: listColors });

  // Mirrors the colour rule: a lot with no designs attached offers all of them.
  const visibleDesigns = (designs ?? []).filter(
    (d) => !allowedDesignIds || allowedDesignIds.length === 0 || allowedDesignIds.includes(d.id),
  );

  const rows: ColorRow[] = useMemo(() => {
    if (colorTargets.length > 0) {
      return colorTargets.map((t) => ({
        id: t.color_id,
        name: t.name,
        hex: t.hex,
        planned: t.quantity,
      }));
    }
    return (allColors ?? []).map((c) => ({ id: c.id, name: c.name, hex: c.hex, planned: null }));
  }, [colorTargets, allColors]);

  // With just one or two machines there's nothing to gain from hiding any, so
  // pre-select them all; otherwise start empty and let the operator tap.
  const [selectedIds, setSelectedIds] = useState<number[]>(
    assigned.length <= 2 ? assigned.map((m) => m.id) : [],
  );
  // qty[colourId][machineId] = raw string
  const [qty, setQty] = useState<Record<number, Record<number, string>>>({});
  const [stageVals, setStageVals] = useState<ValMap>({});
  const [rowDesign, setRowDesign] = useState<Record<number, number | "">>({});
  const [lastDesign, setLastDesign] = useState<number | "">(lastDesignId ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const submittedOrder = useRef<number[]>([]);

  const requireDesign = stage.requires_design_color;
  const selectedMachines = assigned.filter((m) => selectedIds.includes(m.id));

  const toggleMachine = (mid: number) =>
    setSelectedIds((prev) => (prev.includes(mid) ? prev.filter((x) => x !== mid) : [...prev, mid]));

  // A row shows its own design once touched, otherwise the sticky last-picked one.
  const designFor = (cid: number): number | "" => (cid in rowDesign ? rowDesign[cid] : lastDesign);
  const setDesign = (cid: number, val: number | "") => {
    setRowDesign((prev) => ({ ...prev, [cid]: val }));
    setLastDesign(val); // carry to still-untouched rows
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
    if (filledRows.length === 0) {
      setLocalError("Enter a quantity for at least one machine.");
      return;
    }
    if (requireDesign) {
      const missing = filledRows.filter((r) => designFor(r.id) === "");
      if (missing.length) {
        setLocalError(`Please choose a design for: ${missing.map((r) => r.name).join(", ")}.`);
        return;
      }
    }
    setLocalError(null);

    const data = buildRecord(stageFields, stageVals);
    submittedOrder.current = filledRows.map((r) => r.id);
    const entries: StageEntrySubmit[] = filledRows.map((r) => {
      const d = designFor(r.id);
      return {
        data,
        machines: machinesForColor(r.id),
        design_id: d === "" ? null : d,
        color_id: r.id,
      };
    });
    onSubmit(entries);
  };

  return (
    <div className="space-y-4">
      {generalErrors.length > 0 && <ErrorBanner message={generalErrors.join("; ")} />}
      {localError && <ErrorBanner message={localError} />}

      {stage.has_machines && (
        <Field label="Machines you ran" required>
          {assigned.length === 0 ? (
            <p className="text-sm text-slate-400">No machines assigned to this stage.</p>
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
                        ? "border-brand bg-brand-50 text-brand"
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
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">
            No colours available. Add colours on the Design page, or set a colour split for this lot.
          </p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const done = doneByColorId[r.id] ?? 0;
              const left = r.planned != null ? round2(r.planned - done) : null;
              const errs = rowErrors.get(r.id);
              return (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-300"
                        style={{ background: r.hex ?? "transparent" }}
                      />
                      {r.name}
                    </span>
                    {r.planned != null && (
                      <span className="text-xs text-slate-400">
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

                  <div className="mt-2.5">
                    <Field label="Design" required={requireDesign} className="max-w-xs">
                      <Select
                        value={designFor(r.id)}
                        onChange={(e) => setDesign(r.id, e.target.value ? Number(e.target.value) : "")}
                      >
                        <option value="">— none —</option>
                        {visibleDesigns.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  {stage.has_machines &&
                    (selectedMachines.length === 0 ? (
                      <p className="mt-2.5 text-xs text-slate-400">
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

      <div className="sticky bottom-0 -mx-6 flex flex-col gap-2 border-t border-slate-100 bg-white px-6 pt-3 sm:flex-row sm:items-center sm:justify-between">
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
