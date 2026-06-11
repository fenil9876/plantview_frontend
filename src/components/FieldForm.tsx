import { useState, type FormEvent } from "react";
import { DATA_TYPES, SCOPES } from "../lib/constants";
import { slugifyKey } from "../lib/util";
import type { DataType, FieldDefCreate, FieldScope } from "../lib/types";
import { Plus } from "lucide-react";
import { Button, Field, Input, Select } from "./ui";

interface Props {
  allowMachineScopes: boolean;
  onAdd: (field: FieldDefCreate) => void;
  onError?: (message: string) => void;
}

export function FieldForm({ allowMachineScopes, onAdd, onError }: Props) {
  const [scope, setScope] = useState<FieldScope>("stage");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [dataType, setDataType] = useState<DataType>("string");
  const [required, setRequired] = useState(false);
  const [unit, setUnit] = useState("");
  const [optionsText, setOptionsText] = useState("");

  const scopeOptions = allowMachineScopes ? SCOPES : SCOPES.filter((s) => s.value === "stage");

  const reset = () => {
    setLabel("");
    setKey("");
    setKeyEdited(false);
    setDataType("string");
    setRequired(false);
    setUnit("");
    setOptionsText("");
  };

  const onLabelChange = (v: string) => {
    setLabel(v);
    if (!keyEdited) setKey(slugifyKey(v));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const finalKey = key || slugifyKey(label);
    if (!finalKey) return onError?.("Field needs a name");

    let options: string[] | null = null;
    if (dataType === "enum") {
      options = optionsText.split(",").map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) return onError?.("Dropdown fields need at least one option");
    }

    onAdd({
      scope,
      key: finalKey,
      label: label.trim(),
      data_type: dataType,
      required,
      options,
      unit: unit.trim() || null,
    });
    reset();
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Column name">
          <Input value={label} onChange={(e) => onLabelChange(e.target.value)} required />
        </Field>
        <Field label="Key">
          <Input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setKeyEdited(true);
            }}
            placeholder="auto"
          />
        </Field>
        <Field label="Type">
          <Select value={dataType} onChange={(e) => setDataType(e.target.value as DataType)}>
            {DATA_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scope">
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as FieldScope)}
            disabled={scopeOptions.length === 1}
          >
            {scopeOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:items-end">
        {dataType === "enum" && (
          <Field label="Options" hint="comma separated" className="col-span-2">
            <Input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="day, night"
            />
          </Field>
        )}
        <Field label="Unit">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, m…" />
        </Field>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-brand focus:ring-brand/40"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Required
        </label>
        <Button type="submit" variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>
          Add column
        </Button>
      </div>
    </form>
  );
}
