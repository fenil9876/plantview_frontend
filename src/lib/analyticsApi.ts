import { api } from "./api";
import type {
  CountByStatus,
  CountByTemplate,
  FieldAggregateResult,
  MachineActivity,
  MachineIO,
  Overview,
  StageDistribution,
  TimeseriesPoint,
} from "./types";

export async function getOverview(): Promise<Overview> {
  return (await api.get<Overview>("/analytics/overview")).data;
}

export async function getBatchesByStatus(): Promise<CountByStatus[]> {
  return (await api.get<CountByStatus[]>("/analytics/batches/by-status")).data;
}

export async function getBatchesByTemplate(): Promise<CountByTemplate[]> {
  return (await api.get<CountByTemplate[]>("/analytics/batches/by-template")).data;
}

export async function getBatchesTimeseries(interval: string): Promise<TimeseriesPoint[]> {
  return (await api.get<TimeseriesPoint[]>("/analytics/batches/timeseries", { params: { interval } }))
    .data;
}

export async function getBatchesByCurrentStage(templateId: number): Promise<StageDistribution[]> {
  return (
    await api.get<StageDistribution[]>("/analytics/batches/by-current-stage", {
      params: { template_id: templateId },
    })
  ).data;
}

export async function getMachineActivity(): Promise<MachineActivity[]> {
  return (await api.get<MachineActivity[]>("/analytics/machines/activity")).data;
}

export async function getFieldAggregate(params: {
  scope: string;
  field: string;
  op: string;
  template_id?: number;
  stage_id?: number;
  machine_id?: number;
  group_by?: string;
}): Promise<FieldAggregateResult> {
  return (await api.get<FieldAggregateResult>("/analytics/field-aggregate", { params })).data;
}

export async function getMachineIoSummary(params: {
  input_field: string;
  output_field: string;
  stage_id?: number;
  template_id?: number;
}): Promise<MachineIO[]> {
  return (await api.get<MachineIO[]>("/analytics/machines/io-summary", { params })).data;
}
