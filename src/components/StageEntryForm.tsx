import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type {
  BatchDesign,
  FieldDef,
  Machine,
  StageEntry,
  StageEntrySubmit,
  Stage,
  ValidationFieldError,
} from "../lib/types";
import { listColors, listDesigns } from "../lib/designApi";
import { DynamicField, type FieldValue } from "./DynamicField";
import { Button, ErrorBanner, Field, Input, Select } from "./ui";

type ValMap = Record<string, FieldValue>;
interface MachineVals {
  input: ValMap;
  output: ValMap;
  quantity: string;
  description: string;
}

function toFormValue(field: FieldDef, raw: unknown): FieldValue {
  if (field.data_type === "bool") return raw === true;
  return raw == null ? "" : String(raw);
}

function initVals(fields: FieldDef[], data: Record<string, unknown> | undefined): ValMap {
  const out: ValMap = {};
  for (const f of fields) out[f.key] = toFormValue(f, data?.[f.key]);
  return out;
}

/** Drop empties; keep booleans as-is. */
function buildRecord(fields: FieldDef[], vals: ValMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = vals[f.key];
    if (f.data_type === "bool") out[f.key] = v === true;
    else if (typeof v === "string" && v.trim() !== "") out[f.key] = v;
  }
  return out;
}

interface Props {
  stage: Stage;
  machines: Machine[];
  existing?: StageEntry;
  errors: ValidationFieldError[];
  canEdit: boolean;
  submitting: boolean;
  /**
   * The lot's designs with the colours under each. The design picker is limited
   * to these, and the colour picker to the chosen design's own colours. Empty =
   * no restriction (every design and colour offered).
   */
  lotDesigns?: BatchDesign[];
  /** Show a "Save & add another" button that keeps the form open after saving. */
  allowAddAnother?: boolean;
  onSubmit: (payload: StageEntrySubmit, addAnother?: boolean) => void;
  onCancel?: () => void;
}

export function StageEntryForm({
  stage,
  machines,
  existing,
  errors,
  canEdit,
  submitting,
  lotDesigns,
  allowAddAnother,
  onSubmit,
  onCancel,
}: Props) {
  const stageFields = stage.field_defs.filter((f) => f.scope === "stage");
  const inputFields = stage.field_defs.filter((f) => f.scope === "machine_input");
  const outputFields = stage.field_defs.filter((f) => f.scope === "machine_output");
  const assigned = stage.machine_ids
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is Machine => !!m);

  const { data: designs } = useQuery({ queryKey: ["designs"], queryFn: listDesigns });
  const { data: colors } = useQuery({ queryKey: ["colors"], queryFn: listColors });

  const [designId, setDesignId] = useState<number | "">(existing?.design_id ?? "");
  const [colorId, setColorId] = useState<number | "">(existing?.color_id ?? "");

  // A lot with no designs attached is unrestricted. Otherwise only its designs
  // may be picked — plus whatever this entry already uses, so editing an older
  // entry never silently drops its design.
  const restricted = (lotDesigns?.length ?? 0) > 0;
  const visibleDesigns = (designs ?? []).filter(
    (d) =>
      !restricted ||
      lotDesigns!.some((ld) => ld.design_id === d.id) ||
      d.id === existing?.design_id,
  );

  // Colours belong to a design, so the picker follows the design chosen above.
  const lotDesign = lotDesigns?.find((ld) => ld.design_id === designId);
  const visibleColors = (colors ?? []).filter(
    (cl) =>
      !restricted ||
      !lotDesign ||
      lotDesign.colors.length === 0 ||
      lotDesign.colors.some((c) => c.color_id === cl.id) ||
      cl.id === existing?.color_id,
  );

  const chooseDesign = (next: number | "") => {
    setDesignId(next);
    // The old colour may not belong to the new design — drop it rather than
    // submit a pair the lot doesn't run.
    const nextLot = lotDesigns?.find((ld) => ld.design_id === next);
    if (
      colorId !== "" &&
      nextLot &&
      nextLot.colors.length > 0 &&
      !nextLot.colors.some((c) => c.color_id === colorId)
    ) {
      setColorId("");
    }
  };

  const [stageVals, setStageVals] = useState<ValMap>(() => initVals(stageFields, existing?.data));
  const [machineVals, setMachineVals] = useState<Record<number, MachineVals>>(() => {
    const out: Record<number, MachineVals> = {};
    for (const id of stage.machine_ids) {
      const me = existing?.machine_entries.find((e) => e.machine_id === id);
      out[id] = {
        input: initVals(inputFields, me?.input_data),
        output: initVals(outputFields, me?.output_data),
        quantity: me?.quantity != null ? String(me.quantity) : "",
        description: me?.description ?? "",
      };
    }
    return out;
  });

  const errMap = new Map(errors.map((e) => [`${e.scope}:${e.field}`, e.error]));
  const generalErrors = errors.filter((e) => e.scope === "machines");

  // Some stages require design + color; machine stages also require ≥1 machine (description stays optional).
  const requireDesignColor = stage.requires_design_color;
  const [localError, setLocalError] = useState<string | null>(null);

  const setMachineVal = (mid: number, io: "input" | "output", key: string, v: FieldValue) =>
    setMachineVals((prev) => ({
      ...prev,
      [mid]: { ...prev[mid], [io]: { ...prev[mid][io], [key]: v } },
    }));

  const setMachineMeta = (mid: number, key: "quantity" | "description", v: string) =>
    setMachineVals((prev) => ({ ...prev, [mid]: { ...prev[mid], [key]: v } }));

  // Tap-to-add quantity popup state (simple machine stages).
  const [pickId, setPickId] = useState<number | null>(null);
  const [pickQty, setPickQty] = useState("");
  const pickMachine = assigned.find((m) => m.id === pickId);

  const openPicker = (mid: number) => {
    setPickId(mid);
    setPickQty(machineVals[mid]?.quantity ?? "");
  };
  const confirmPicker = () => {
    if (pickId !== null) setMachineMeta(pickId, "quantity", pickQty.trim());
    setPickId(null);
  };
  const removeMachine = (mid: number) => setMachineMeta(mid, "quantity", "");
  const isUsed = (mid: number) => (machineVals[mid]?.quantity ?? "").trim() !== "";

  const submit = (addAnother = false) => {
    const machinesPayload = assigned
      .map((m) => {
        const mv = machineVals[m.id];
        const input = buildRecord(inputFields, mv?.input ?? {});
        const output = buildRecord(outputFields, mv?.output ?? {});
        const qtyStr = mv?.quantity?.trim() ?? "";
        const quantity = qtyStr !== "" && !Number.isNaN(Number(qtyStr)) ? Number(qtyStr) : null;
        const description = mv?.description?.trim() ? mv.description.trim() : null;
        return { machine_id: m.id, input_data: input, output_data: output, quantity, description };
      })
      .filter(
        (m) =>
          Object.keys(m.input_data).length ||
          Object.keys(m.output_data).length ||
          m.quantity != null ||
          m.description != null,
      );

    // Required-field checks for machine stages.
    const missing: string[] = [];
    if (requireDesignColor && designId === "") missing.push("Design");
    if (requireDesignColor && colorId === "") missing.push("Color");
    if (stage.has_machines && machinesPayload.length === 0)
      missing.push("at least one machine with a quantity");
    if (missing.length) {
      setLocalError(`Please add: ${missing.join(", ")}.`);
      return;
    }
    setLocalError(null);

    onSubmit(
      {
        data: buildRecord(stageFields, stageVals),
        machines: machinesPayload,
        design_id: designId === "" ? null : designId,
        color_id: colorId === "" ? null : colorId,
      },
      addAnother,
    );
  };

  return (
    <div className="space-y-4">
      {generalErrors.length > 0 && (
        <ErrorBanner message={generalErrors.map((e) => `${e.field}: ${e.error}`).join("; ")} />
      )}
      {localError && <ErrorBanner message={localError} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Design" required={requireDesignColor}>
          <Select
            value={designId}
            disabled={!canEdit}
            onChange={(e) => chooseDesign(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— none —</option>
            {visibleDesigns.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Color"
          required={requireDesignColor}
          hint={restricted && designId === "" ? "Pick a design first." : undefined}
        >
          <Select
            value={colorId}
            disabled={!canEdit || (restricted && designId === "")}
            onChange={(e) => setColorId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— none —</option>
            {visibleColors.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {stageFields.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {stageFields.map((f) => (
            <DynamicField
              key={f.id}
              field={f}
              value={stageVals[f.key]}
              disabled={!canEdit}
              error={errMap.get(`stage:${f.key}`)}
              onChange={(v) => setStageVals((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>
      )}

      {stage.has_machines && assigned.length > 0 && inputFields.length === 0 && outputFields.length === 0 && (
        <div className="space-y-3">
          {/* Machines already added, with quantity + remove */}
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Machines used</div>
            {assigned.filter((m) => isUsed(m.id)).length === 0 ? (
              <p className="text-sm text-slate-500">None yet — tap a machine below to add it.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assigned
                  .filter((m) => isUsed(m.id))
                  .map((m) => (
                    // Chip height is a touch target, not decoration: this is
                    // tapped repeatedly to correct quantities during a run.
                    <span
                      key={m.id}
                      className="inline-flex h-11 items-center gap-1 rounded-full border border-brand bg-brand-50 pl-3.5 pr-1 text-sm text-brand-800 sm:h-9"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openPicker(m.id)}
                        className="h-full font-medium"
                        title="Tap to change quantity"
                      >
                        {m.name}: <span className="tabular font-semibold">{machineVals[m.id]?.quantity}</span>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeMachine(m.id)}
                          aria-label={`Remove ${m.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-brand hover:bg-brand hover:text-white sm:h-6 sm:w-6"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Tap a machine to add it */}
          {canEdit && (
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-700">Add a machine</div>
              <div className="flex flex-wrap gap-2">
                {assigned
                  .filter((m) => !isUsed(m.id))
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openPicker(m.id)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors active:scale-[0.97] hover:border-brand hover:bg-brand-50 hover:text-brand sm:h-9"
                    >
                      <Plus className="h-4 w-4" />
                      {m.name}
                    </button>
                  ))}
                {assigned.every((m) => isUsed(m.id)) && (
                  <span className="text-sm text-slate-500">All machines added.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quantity popup */}
      {pickId !== null && pickMachine && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
          onClick={() => setPickId(null)}
        >
          {/* A sheet, not a centred box: the numeric keypad opens over the
              bottom half of the screen, and a centred dialog ends up hidden
              behind it. */}
          <div
            className="w-full rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-pop animate-sheet-up sm:max-w-xs sm:rounded-2xl sm:pb-5 sm:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{pickMachine.name}</h3>
            <p className="mt-0.5 text-sm text-slate-500">Enter quantity</p>
            <Input
              type="number"
              step="any"
              autoFocus
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmPicker()}
              // Bigger than a normal field — it is the only thing on this sheet.
              className="tabular mt-3 h-14 text-center text-2xl font-semibold sm:h-12 sm:text-xl"
            />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setPickId(null)}>
                Cancel
              </Button>
              <Button onClick={confirmPicker} disabled={pickQty.trim() === ""}>
                {isUsed(pickMachine.id) ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage.has_machines && assigned.length > 0 && (inputFields.length > 0 || outputFields.length > 0) && (
        <div className="space-y-3">
          {assigned.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-sm font-semibold text-slate-800">
                {m.name} <span className="font-mono text-xs font-normal text-slate-500">({m.code})</span>
              </div>

              <div className="mt-2 max-w-xs">
                <Field label="Quantity">
                  <Input
                    type="number"
                    step="any"
                    value={machineVals[m.id]?.quantity ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setMachineMeta(m.id, "quantity", e.target.value)}
                  />
                </Field>
              </div>

              {inputFields.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Input</div>
                  <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {inputFields.map((f) => (
                      <DynamicField
                        key={f.id}
                        field={f}
                        value={machineVals[m.id]?.input[f.key]}
                        disabled={!canEdit}
                        error={errMap.get(`machine:${m.id}.input:${f.key}`)}
                        onChange={(v) => setMachineVal(m.id, "input", f.key, v)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {outputFields.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Output</div>
                  <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {outputFields.map((f) => (
                      <DynamicField
                        key={f.id}
                        field={f}
                        value={machineVals[m.id]?.output[f.key]}
                        disabled={!canEdit}
                        error={errMap.get(`machine:${m.id}.output:${f.key}`)}
                        onChange={(v) => setMachineVal(m.id, "output", f.key, v)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {stage.has_machines && assigned.length === 0 && (
        <p className="text-sm text-slate-500">No machines assigned to this stage.</p>
      )}

      {canEdit && (
        // Full-width and stacked on a phone, with the primary action first so
        // it is the closest thing to the thumb after a long scroll.
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          <Button onClick={() => submit(false)} loading={submitting} size="lg">
            {existing ? "Save changes" : "Save"}
          </Button>
          {allowAddAnother && !existing && (
            <Button type="button" variant="subtle" size="lg" onClick={() => submit(true)} disabled={submitting}>
              Save &amp; add another
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
