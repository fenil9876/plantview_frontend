import { api } from "./api";
import type { Machine, MachineCreate } from "./types";

export async function listMachines(): Promise<Machine[]> {
  return (await api.get<Machine[]>("/machines")).data;
}

export async function createMachine(payload: MachineCreate): Promise<Machine> {
  return (await api.post<Machine>("/machines", payload)).data;
}

export async function updateMachine(id: number, payload: Partial<MachineCreate>): Promise<Machine> {
  return (await api.patch<Machine>(`/machines/${id}`, payload)).data;
}

export async function deleteMachine(id: number): Promise<void> {
  await api.delete(`/machines/${id}`);
}
