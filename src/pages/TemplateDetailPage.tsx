import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import {
  addField,
  addStage,
  deleteField,
  deleteStage,
  getTemplate,
  setStageMachines,
  updateTemplate,
} from "../lib/templatesApi";
import { listMachines } from "../lib/machinesApi";
import { DATA_TYPE_LABEL, SCOPE_LABEL } from "../lib/constants";
import type { FieldDefCreate, Machine, Stage } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
} from "../components/ui";
import { FieldForm } from "../components/FieldForm";

export function TemplateDetailPage() {
  const { id } = useParams();
  const templateId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const { data: template, isLoading } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplate(templateId),
  });
  const { data: machines } = useQuery({ queryKey: ["machines"], queryFn: listMachines });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["template", templateId] });
    qc.invalidateQueries({ queryKey: ["templates"] });
  };
  const fail = (e: unknown) => toast.error(apiErrorMessage(e));

  const [newStageName, setNewStageName] = useState("");
  const [newStageMachines, setNewStageMachines] = useState(false);

  const addStageMut = useMutation({
    mutationFn: () =>
      addStage(templateId, {
        name: newStageName.trim(),
        order_index: template?.stages.length ?? 0,
        has_machines: newStageMachines,
      }),
    onSuccess: () => {
      setNewStageName("");
      setNewStageMachines(false);
      toast.success("Stage added");
      refresh();
    },
    onError: fail,
  });
  const deleteStageMut = useMutation({
    mutationFn: (stageId: number) => deleteStage(templateId, stageId),
    onSuccess: () => {
      toast.success("Stage deleted");
      refresh();
    },
    onError: fail,
  });
  const addFieldMut = useMutation({
    mutationFn: (v: { stageId: number; field: FieldDefCreate }) =>
      addField(templateId, v.stageId, v.field),
    onSuccess: () => {
      toast.success("Column added");
      refresh();
    },
    onError: fail,
  });
  const deleteFieldMut = useMutation({
    mutationFn: (v: { stageId: number; fieldId: number }) =>
      deleteField(templateId, v.stageId, v.fieldId),
    onSuccess: refresh,
    onError: fail,
  });
  const toggleActiveMut = useMutation({
    mutationFn: () => updateTemplate(templateId, { is_active: !template?.is_active }),
    onSuccess: refresh,
    onError: fail,
  });

  if (isLoading || !template) return <Spinner label="Loading template…" />;

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {template.name}
            <Badge tone={template.is_active ? "green" : "gray"}>
              {template.is_active ? "active" : "inactive"}
            </Badge>
          </span>
        }
        subtitle={`Version ${template.version}`}
        backTo="/templates"
        backLabel="Templates"
        actions={
          <Button variant="secondary" onClick={() => toggleActiveMut.mutate()}>
            {template.is_active ? "Deactivate" : "Activate"}
          </Button>
        }
      />

      {template.stages.map((stage) => (
        <StageCard
          key={stage.id}
          stage={stage}
          machines={machines ?? []}
          onAddField={(field) => addFieldMut.mutate({ stageId: stage.id, field })}
          onDeleteField={(fieldId) => deleteFieldMut.mutate({ stageId: stage.id, fieldId })}
          onDeleteStage={() =>
            confirm({
              title: "Delete stage",
              message: `Are you sure you want to delete stage "${stage.name}"? This action cannot be undone.`,
              onConfirm: () => deleteStageMut.mutate(stage.id),
            })
          }
          onSaveMachines={(ids) =>
            setStageMachines(templateId, stage.id, ids)
              .then(() => {
                toast.success("Machines updated");
                refresh();
              })
              .catch(fail)
          }
          onError={(m) => toast.error(m)}
        />
      ))}

      <Card title="Add stage">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Stage name" className="flex-1">
            <Input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand focus:ring-brand/40"
              checked={newStageMachines}
              onChange={(e) => setNewStageMachines(e.target.checked)}
            />
            Runs on machines
          </label>
          <Button
            onClick={() => newStageName.trim() && addStageMut.mutate()}
            loading={addStageMut.isPending}
          >
            Add stage
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StageCard({
  stage,
  machines,
  onAddField,
  onDeleteField,
  onDeleteStage,
  onSaveMachines,
  onError,
}: {
  stage: Stage;
  machines: Machine[];
  onAddField: (field: FieldDefCreate) => void;
  onDeleteField: (fieldId: number) => void;
  onDeleteStage: () => void;
  onSaveMachines: (ids: number[]) => void;
  onError: (m: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>(stage.machine_ids);
  const activeMachines = machines.filter((m) => m.is_active || stage.machine_ids.includes(m.id));
  const dirty =
    selected.length !== stage.machine_ids.length ||
    selected.some((id) => !stage.machine_ids.includes(id));

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {stage.order_index + 1}. {stage.name}
          {stage.has_machines && <Badge tone="indigo">machines</Badge>}
        </span>
      }
      actions={
        <Button variant="ghost" size="sm" onClick={onDeleteStage}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      }
    >
      {stage.has_machines && (
        <div className="mb-4">
          <div className="text-sm font-medium text-slate-700">Machines</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {activeMachines.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    on ? "border-brand bg-brand-50 text-brand" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
            {dirty && (
              <Button size="sm" variant="secondary" onClick={() => onSaveMachines(selected)}>
                Save machines
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="text-sm font-medium text-slate-700">Columns</div>
      {stage.field_defs.length > 0 ? (
        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {stage.field_defs.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-800">{f.label}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {f.key} · {DATA_TYPE_LABEL[f.data_type]} · {SCOPE_LABEL[f.scope]}
                  {f.required ? " · required" : ""}
                  {f.unit ? ` · ${f.unit}` : ""}
                </span>
              </div>
              <button
                onClick={() => onDeleteField(f.id)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Remove column"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No columns yet.</p>
      )}
      <div className="mt-3">
        <FieldForm allowMachineScopes={stage.has_machines} onAdd={onAddField} onError={onError} />
      </div>
    </Card>
  );
}
