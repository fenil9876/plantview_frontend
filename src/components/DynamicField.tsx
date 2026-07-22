import type { FieldDef } from "../lib/types";
import { Input, Select } from "./ui";

export type FieldValue = string | boolean;

interface Props {
  field: FieldDef;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
  disabled?: boolean;
}

export function DynamicField({ field, value, onChange, error, disabled }: Props) {
  const asStr = typeof value === "string" ? value : "";

  const control = () => {
    switch (field.data_type) {
      case "bool":
        return (
          // The whole row is the target — a bare 13px checkbox is unhittable
          // with a thumb, and this sits among 44px-tall inputs.
          <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700 sm:h-10">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 accent-brand"
              checked={value === true}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
            />
            Yes
          </label>
        );
      case "enum":
        return (
          <Select value={asStr} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        );
      case "int":
      case "decimal":
        return (
          <Input
            type="number"
            step={field.data_type === "int" ? "1" : "any"}
            value={asStr}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "date":
        return (
          <Input type="date" value={asStr} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        );
      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={asStr.slice(0, 16)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      default:
        return (
          <Input value={asStr} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
        {field.unit && <span className="ml-1 text-xs text-slate-500">({field.unit})</span>}
      </label>
      <div className="mt-1.5">{control()}</div>
      {error && <div className="mt-1 text-xs font-medium text-red-600">{error}</div>}
    </div>
  );
}
