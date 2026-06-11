import { api } from "./api";
import type { Color, Design } from "./types";

export interface ColorPayload {
  name: string;
  hex?: string | null;
}
export interface DesignPayload {
  name: string;
  description?: string | null;
}

// Colors
export async function listColors(): Promise<Color[]> {
  return (await api.get<Color[]>("/colors")).data;
}
export async function createColor(payload: ColorPayload): Promise<Color> {
  return (await api.post<Color>("/colors", payload)).data;
}
export async function updateColor(id: number, payload: Partial<ColorPayload>): Promise<Color> {
  return (await api.patch<Color>(`/colors/${id}`, payload)).data;
}
export async function deleteColor(id: number): Promise<void> {
  await api.delete(`/colors/${id}`);
}

// Designs
export async function listDesigns(): Promise<Design[]> {
  return (await api.get<Design[]>("/designs")).data;
}
export async function createDesign(payload: DesignPayload): Promise<Design> {
  return (await api.post<Design>("/designs", payload)).data;
}
export async function updateDesign(id: number, payload: Partial<DesignPayload>): Promise<Design> {
  return (await api.patch<Design>(`/designs/${id}`, payload)).data;
}
export async function deleteDesign(id: number): Promise<void> {
  await api.delete(`/designs/${id}`);
}
