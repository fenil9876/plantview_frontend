import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFieldAggregate } from "../lib/analyticsApi";
import { getTemplate, listTemplates } from "../lib/templatesApi";
import { DATA_TYPE_LABEL, SCOPE_LABEL } from "../lib/constants";
import { Card, Field, Select } from "./ui";

const OPS = ["sum", "avg", "min", "max", "count"];

export function FieldExplorer() {
  const [templateId, setTemplateId] = useState<number | "">("");
  const [stageId, setStageId] = useState<number | "">("");
  const [fieldId, setFieldId] = useState<number | "">("");
  const [op, setOp] = useState("sum");

  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplate(templateId as number),
    enabled: typeof templateId === "number",
  });

  const stages = template?.stages ?? [];
  const stage = stages.find((s) => s.id === stageId);
  const field = stage?.field_defs.find((f) => f.id === fieldId);
  const groupBy = field && field.scope !== "stage" ? "machine" : undefined;

  const { data: result, isFetching } = useQuery({
    queryKey: ["field-aggregate", templateId, stageId, fieldId, op],
    queryFn: () =>
      getFieldAggregate({
        scope: field!.scope,
        field: field!.key,
        op,
        template_id: templateId as number,
        stage_id: stageId as number,
        group_by: groupBy,
      }),
    enabled: !!field,
  });

  const chartData = useMemo(
    () => result?.groups.map((g) => ({ name: g.group_label, value: g.value ?? 0 })) ?? [],
    [result],
  );

  return (
    <Card title="Field explorer" subtitle="Aggregate any column you defined — machine columns break down per machine.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Template">
          <Select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value ? Number(e.target.value) : "");
              setStageId("");
              setFieldId("");
            }}
          >
            <option value="">Select…</option>
            {templates?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage">
          <Select
            value={stageId}
            disabled={!stages.length}
            onChange={(e) => {
              setStageId(e.target.value ? Number(e.target.value) : "");
              setFieldId("");
            }}
          >
            <option value="">Select…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Column">
          <Select
            value={fieldId}
            disabled={!stage}
            onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select…</option>
            {stage?.field_defs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({DATA_TYPE_LABEL[f.data_type]} · {SCOPE_LABEL[f.scope]})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Metric">
          <Select value={op} onChange={(e) => setOp(e.target.value)}>
            {OPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        {!field ? (
          <p className="text-sm text-slate-500">Pick a template, stage and column.</p>
        ) : isFetching ? (
          <p className="text-sm text-slate-500">Calculating…</p>
        ) : groupBy ? (
          chartData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#1f6feb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No data for this column yet.</p>
          )
        ) : (
          <div className="rounded-lg bg-slate-50 p-6 text-center">
            <div className="text-sm text-slate-500">
              {op} of {field.label}
            </div>
            <div className="mt-1 text-3xl font-bold text-slate-800">
              {result?.value ?? "—"}
              {field.unit && result?.value != null && (
                <span className="ml-1 text-base font-normal text-slate-500">{field.unit}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
