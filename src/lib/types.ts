export type Role = "admin" | "operator" | "viewer";

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  roles: Role[];
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Color {
  id: number;
  name: string;
  hex: string | null;
  created_at: string;
}

export interface Design {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  updated_at: string;
}

export type DataType = "string" | "int" | "decimal" | "bool" | "date" | "datetime" | "enum";
export type FieldScope = "stage" | "machine_input" | "machine_output";

export interface Machine {
  id: number;
  name: string;
  code: string;
  type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MachineCreate {
  name: string;
  code: string;
  type?: string | null;
  is_active?: boolean;
}

export interface FieldDef {
  id: number;
  stage_id: number;
  scope: FieldScope;
  key: string;
  label: string;
  data_type: DataType;
  required: boolean;
  options: string[] | null;
  validation: Record<string, unknown> | null;
  unit: string | null;
  order_index: number;
}

export interface FieldDefCreate {
  scope: FieldScope;
  key: string;
  label: string;
  data_type: DataType;
  required: boolean;
  options?: string[] | null;
  validation?: Record<string, unknown> | null;
  unit?: string | null;
  order_index?: number;
}

export interface Stage {
  id: number;
  template_id: number;
  name: string;
  order_index: number;
  has_machines: boolean;
  requires_design_color: boolean;
  field_defs: FieldDef[];
  machine_ids: number[];
}

export interface StageCreate {
  name: string;
  order_index?: number;
  has_machines?: boolean;
  requires_design_color?: boolean;
  fields?: FieldDefCreate[];
  machine_ids?: number[];
}

export interface TemplateSummary {
  id: number;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface TemplateRead extends TemplateSummary {
  stages: Stage[];
}

export interface TemplateCreate {
  name: string;
  description?: string | null;
  version?: number;
  stages: StageCreate[];
}

export type BatchStatus = "in_progress" | "completed" | "cancelled";
export type EntryStatus = "draft" | "submitted";

export interface MachineEntry {
  id: number;
  machine_id: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  quantity: number | null;
  description: string | null;
  operator_id: number | null;
}

export interface StageEntry {
  id: number;
  batch_id: number;
  stage_id: number;
  data: Record<string, unknown>;
  status: EntryStatus;
  design_id: number | null;
  design_name: string | null;
  color_id: number | null;
  color_name: string | null;
  color_hex: string | null;
  submitted_by: number | null;
  submitted_by_name: string | null;
  machine_entries: MachineEntry[];
  updated_at: string;
}

export interface BatchSummary {
  id: number;
  template_id: number;
  code: string;
  lot_size: number | null;
  current_stage_id: number | null;
  status: BatchStatus;
  created_by: number | null;
  created_at: string;
}

export interface BatchMaterial {
  inventory_item_id: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface BatchColorTarget {
  color_id: number;
  name: string;
  hex: string | null;
  quantity: number;
}

export interface BatchRead extends BatchSummary {
  stage_entries: StageEntry[];
  materials: BatchMaterial[];
  color_targets: BatchColorTarget[];
}

export interface BatchMaterialSubmit {
  inventory_item_id: number;
  quantity: number;
}

export interface BatchColorTargetSubmit {
  color_id: number;
  quantity: number;
}

export interface BatchCreate {
  template_id: number;
  code: string;
  lot_size?: number | null;
}

export interface BatchUpdate {
  lot_size?: number | null;
}

export interface MachineEntrySubmit {
  machine_id: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  quantity?: number | null;
  description?: string | null;
}

export interface StageEntrySubmit {
  data: Record<string, unknown>;
  machines: MachineEntrySubmit[];
  design_id?: number | null;
  color_id?: number | null;
  status?: EntryStatus;
}

export interface ValidationFieldError {
  scope: string;
  field: string;
  error: string;
}

export interface Overview {
  templates_total: number;
  templates_active: number;
  machines_total: number;
  machines_active: number;
  batches_total: number;
  batches_by_status: Record<string, number>;
  stage_entries_total: number;
  machine_entries_total: number;
}

export interface CountByStatus {
  status: string;
  count: number;
}

export interface CountByTemplate {
  template_id: number;
  template_name: string;
  count: number;
}

export interface TimeseriesPoint {
  period: string;
  count: number;
}

export interface StageDistribution {
  stage_id: number;
  stage_name: string;
  order_index: number;
  count: number;
}

export interface MachineActivity {
  machine_id: number;
  machine_name: string;
  code: string;
  entries: number;
  batches: number;
}

export interface FieldAggregateGroup {
  group_id: number;
  group_label: string;
  value: number | null;
  count: number;
}

export interface FieldAggregateResult {
  scope: string;
  field: string;
  op: string;
  value: number | null;
  groups: FieldAggregateGroup[];
}

export interface MachineIO {
  machine_id: number;
  machine_name: string;
  input_total: number;
  output_total: number;
  wastage: number;
  yield_pct: number | null;
  entries: number;
}
