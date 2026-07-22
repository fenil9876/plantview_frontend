import { api } from "./api";
import type {
  BatchCreate,
  BatchDesignSubmit,
  BatchMaterialSubmit,
  BatchRead,
  BatchStatus,
  BatchSummary,
  BatchUpdate,
  StageEntry,
  StageEntrySubmit,
} from "./types";

export async function listBatches(params?: {
  template_id?: number;
  status?: BatchStatus;
  /** Case-insensitive substring match on the batch code. */
  search?: string;
}): Promise<BatchSummary[]> {
  return (await api.get<BatchSummary[]>("/batches", { params })).data;
}

export async function getBatch(id: number): Promise<BatchRead> {
  return (await api.get<BatchRead>(`/batches/${id}`)).data;
}

export async function createBatch(payload: BatchCreate): Promise<BatchRead> {
  return (await api.post<BatchRead>("/batches", payload)).data;
}

export async function updateBatchStatus(id: number, status: BatchStatus): Promise<BatchRead> {
  return (await api.patch<BatchRead>(`/batches/${id}/status`, { status })).data;
}

export async function updateBatch(id: number, payload: BatchUpdate): Promise<BatchRead> {
  return (await api.patch<BatchRead>(`/batches/${id}`, payload)).data;
}

export async function deleteBatch(id: number): Promise<void> {
  await api.delete(`/batches/${id}`);
}

export async function setBatchMaterials(
  id: number,
  materials: BatchMaterialSubmit[],
): Promise<BatchRead> {
  return (await api.put<BatchRead>(`/batches/${id}/materials`, { materials })).data;
}

/**
 * The designs this lot runs, each with its own colours. Every design must bring
 * at least one colour. An empty list clears the restriction, leaving all designs
 * and colours selectable during entry.
 */
export async function setBatchDesigns(
  id: number,
  designs: BatchDesignSubmit[],
): Promise<BatchRead> {
  return (await api.put<BatchRead>(`/batches/${id}/designs`, { designs })).data;
}

export async function createStageEntry(
  batchId: number,
  stageId: number,
  payload: StageEntrySubmit,
): Promise<StageEntry> {
  return (await api.post<StageEntry>(`/batches/${batchId}/stages/${stageId}/entries`, payload)).data;
}

export async function createStageEntriesBulk(
  batchId: number,
  stageId: number,
  entries: StageEntrySubmit[],
): Promise<StageEntry[]> {
  return (
    await api.post<StageEntry[]>(`/batches/${batchId}/stages/${stageId}/entries/bulk`, { entries })
  ).data;
}

export async function updateStageEntry(
  batchId: number,
  entryId: number,
  payload: StageEntrySubmit,
): Promise<StageEntry> {
  return (await api.put<StageEntry>(`/batches/${batchId}/entries/${entryId}`, payload)).data;
}

export async function deleteStageEntry(batchId: number, entryId: number): Promise<void> {
  await api.delete(`/batches/${batchId}/entries/${entryId}`);
}
