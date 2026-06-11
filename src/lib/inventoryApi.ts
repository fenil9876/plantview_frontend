import { api } from "./api";
import type { InventoryItem } from "./types";

export interface InventoryItemPayload {
  name: string;
  quantity?: number;
  unit?: string;
}

export async function listInventory(): Promise<InventoryItem[]> {
  return (await api.get<InventoryItem[]>("/inventory")).data;
}

export async function createInventoryItem(payload: InventoryItemPayload): Promise<InventoryItem> {
  return (await api.post<InventoryItem>("/inventory", payload)).data;
}

export async function updateInventoryItem(
  id: number,
  payload: Partial<InventoryItemPayload>,
): Promise<InventoryItem> {
  return (await api.patch<InventoryItem>(`/inventory/${id}`, payload)).data;
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await api.delete(`/inventory/${id}`);
}
