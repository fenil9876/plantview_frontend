import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { createTemplate } from "../lib/templatesApi";
import { listMachines } from "../lib/machinesApi";
import { DATA_TYPE_LABEL, SCOPE_LABEL } from "../lib/constants";
import type { FieldDefCreate, TemplateCreate } from "../lib/types";
import { Button, Card, Field, Input, PageHeader, useToast } from "../components/ui";
import { FieldForm } from "../components/FieldForm";

interface StageDraft {
  tempId: number;
  name: string;
  has_machines: boolean;
  machine_ids: number[];
  fields: FieldDefCreate[];
}

export function TemplateBuilderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const nextId = useRef(1);
  const newStage = (): StageDraft => ({
    tempId: nextId.current++,
    name: "",
    has_machines: false,
    machine_ids: [],
    fields: [],
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([newStage()]);

  const { data: machines } = useQuery({ queryKey: ["machines"], queryFn: listMachines });
  const activeMachines = machines?.filter((m) => m.is_active) ?? [];

  const patchStage = (tempId: number, patch: Partial<StageDraft>) =>
    setStages((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));

  const toggleMachines = (s: StageDraft, on: boolean) =>
    patchStage(s.tempId, {
      has_machines: on,
      machine_ids: on ? s.machine_ids : [],
      fields: on ? s.fields : s.fields.filter((f) => f.scope === "stage"),
    });

  const toggleMachineId = (s: StageDraft, id: number) =>
    patchStage(s.tempId, {
      machine_ids: s.machine_ids.includes(id)
        ? s.machine_ids.filter((x) => x !== id)
        : [...s.machine_ids, id],
    });

  const addField = (s: StageDraft, field: FieldDefCreate) => {
    if (s.fields.some((f) => f.scope === field.scope && f.key === field.key)) {
      toast.error(`A "${field.key}" column already exists in ${SCOPE_LABEL[field.scope]}`);
      return;
    }
    patchStage(s.tempId, { fields: [...s.fields, field] });
  };

  const removeField = (s: StageDraft, idx: number) =>
    patchStage(s.tempId, { fields: s.fields.filter((_, i) => i !== idx) });

  const moveStage = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const copy = [...stages];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setStages(copy);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: TemplateCreate = {
        name: name.trim(),
        description: description.trim() || null,
        stages: stages.map((s, i) => ({
          name: s.name.trim(),
          order_index: i,
          has_machines: s.has_machines,
          machine_ids: s.machine_ids,
          fields: s.fields.map((f, fi) => ({ ...f, order_index: fi })),
        })),
      };
      return createTemplate(payload);
    },
    onSuccess: (tpl) => {
      toast.success("Template created");
      navigate(`/templates/${tpl.id}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onSave = () => {
    if (!name.trim()) return toast.error("Template name is required");
    if (stages.some((s) => !s.name.trim())) return toast.error("Every stage needs a name");
    saveMut.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New template"
        backTo="/templates"
        backLabel="Templates"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/templates")}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saveMut.isPending}>
              Save template
            </Button>
          </>
        }
      />

      <Card title="Template details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Template name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template A" />
          </Field>
          <Field label="Description" hint="optional">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Card>

      {stages.map((s, idx) => (
        <Card key={s.tempId}>
          <div className="flex items-start justify-between gap-3">
            <Field label={`Stage ${idx + 1} name`} className="flex-1">
              <Input
                value={s.name}
                onChange={(e) => patchStage(s.tempId, { name: e.target.value })}
                placeholder="Raw materials, Manufacturing…"
              />
            </Field>
            <div className="flex gap-1 pt-7">
              <Button variant="ghost" size="sm" onClick={() => moveStage(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveStage(idx, 1)}
                disabled={idx === stages.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStages((prev) => prev.filter((x) => x.tempId !== s.tempId))}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>

          <label className="mt-3 flex w-fit items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand focus:ring-brand/40"
              checked={s.has_machines}
              onChange={(e) => toggleMachines(s, e.target.checked)}
            />
            This stage runs on machines
          </label>

          {s.has_machines && (
            <div className="mt-3">
              <div className="text-sm font-medium text-slate-700">Machines at this stage</div>
              {activeMachines.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">
                  No active machines. Add machines on the Machines page first.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeMachines.map((m) => {
                    const on = s.machine_ids.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMachineId(s, m.id)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          on
                            ? "border-brand bg-brand-50 text-brand"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {m.name} <span className="text-xs text-slate-400">({m.code})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className="text-sm font-medium text-slate-700">Columns</div>
            {s.fields.length > 0 && (
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {s.fields.map((f, fi) => (
                  <div key={fi} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{f.label}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {f.key} · {DATA_TYPE_LABEL[f.data_type]} · {SCOPE_LABEL[f.scope]}
                        {f.required ? " · required" : ""}
                        {f.unit ? ` · ${f.unit}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => removeField(s, fi)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove column"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <FieldForm
                allowMachineScopes={s.has_machines}
                onAdd={(f) => addField(s, f)}
                onError={(m) => toast.error(m)}
              />
            </div>
          </div>
        </Card>
      ))}

      <Button
        variant="secondary"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => setStages((prev) => [...prev, newStage()])}
      >
        Add stage
      </Button>
    </div>
  );
}
