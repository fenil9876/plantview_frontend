import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type {
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
  /** Restrict the color picker to the lot's color split. Empty = no restriction (all colors). */
  allowedColorIds?: number[];
  onSubmit: (payload: StageEntrySubmit) => void;
  onCancel?: () => void;
}

export function StageEntryForm({
  stage,
  machines,
  existing,
  errors,
  canEdit,
  submitting,
  allowedColorIds,
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

  // When a lot color split is set, only those colors may be picked. Always keep the
  // entry's current color visible so editing never silently drops it.
  const visibleColors = (colors ?? []).filter(
    (cl) =>
      !allowedColorIds ||
      allowedColorIds.length === 0 ||
      allowedColorIds.includes(cl.id) ||
      cl.id === existing?.color_id,
  );

  const [designId, setDesignId] = useState<number | "">(existing?.design_id ?? "");
  const [colorId, setColorId] = useState<number | "">(existing?.color_id ?? "");

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

  const submit = () => {
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

    onSubmit({
      data: buildRecord(stageFields, stageVals),
      machines: machinesPayload,
      design_id: designId === "" ? null : designId,
      color_id: colorId === "" ? null : colorId,
    });
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
            onChange={(e) => setDesignId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— none —</option>
            {designs?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Color" required={requireDesignColor}>
          <Select
            value={colorId}
            disabled={!canEdit}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <p className="text-sm text-slate-400">None yet — tap a machine below to add it.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assigned
                  .filter((m) => isUsed(m.id))
                  .map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-2 rounded-full border border-brand bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openPicker(m.id)}
                        className="font-medium"
                        title="Tap to change quantity"
                      >
                        {m.name}: {machineVals[m.id]?.quantity}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeMachine(m.id)}
                          aria-label={`Remove ${m.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-brand hover:bg-brand hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
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
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand hover:bg-brand-50 hover:text-brand"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {m.name}
                    </button>
                  ))}
                {assigned.every((m) => isUsed(m.id)) && (
                  <span className="text-sm text-slate-400">All machines added.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quantity popup */}
      {pickId !== null && pickMachine && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPickId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">{pickMachine.name}</h3>
            <p className="mt-0.5 text-sm text-slate-500">Enter quantity</p>
            <Input
              type="number"
              step="any"
              autoFocus
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmPicker()}
              className="mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
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
            <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-700">
                {m.name} <span className="text-xs font-normal text-slate-400">({m.code})</span>
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
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Input</div>
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
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Output</div>
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
        <p className="text-sm text-slate-400">No machines assigned to this stage.</p>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : existing ? "Save changes" : "Save"}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
