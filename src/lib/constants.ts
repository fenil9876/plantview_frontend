import type { DataType, FieldScope } from "./types";

export const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "int", label: "Integer" },
  { value: "decimal", label: "Decimal" },
  { value: "bool", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "enum", label: "Dropdown (options)" },
];

export const SCOPES: { value: FieldScope; label: string }[] = [
  { value: "stage", label: "Stage data" },
  { value: "machine_input", label: "Machine input" },
  { value: "machine_output", label: "Machine output" },
];

export const SCOPE_LABEL: Record<FieldScope, string> = {
  stage: "Stage data",
  machine_input: "Machine input",
  machine_output: "Machine output",
};

export const DATA_TYPE_LABEL: Record<DataType, string> = Object.fromEntries(
  DATA_TYPES.map((d) => [d.value, d.label]),
) as Record<DataType, string>;
