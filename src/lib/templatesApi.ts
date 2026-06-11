import { api } from "./api";
import type {
  FieldDef,
  FieldDefCreate,
  Stage,
  StageCreate,
  TemplateCreate,
  TemplateRead,
  TemplateSummary,
} from "./types";

export async function listTemplates(): Promise<TemplateSummary[]> {
  return (await api.get<TemplateSummary[]>("/templates")).data;
}

export async function getTemplate(id: number): Promise<TemplateRead> {
  return (await api.get<TemplateRead>(`/templates/${id}`)).data;
}

export async function createTemplate(payload: TemplateCreate): Promise<TemplateRead> {
  return (await api.post<TemplateRead>("/templates", payload)).data;
}

export async function updateTemplate(
  id: number,
  payload: { name?: string; description?: string | null; is_active?: boolean },
): Promise<TemplateRead> {
  return (await api.patch<TemplateRead>(`/templates/${id}`, payload)).data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/templates/${id}`);
}

export async function addStage(templateId: number, payload: StageCreate): Promise<Stage> {
  return (await api.post<Stage>(`/templates/${templateId}/stages`, payload)).data;
}

export async function deleteStage(templateId: number, stageId: number): Promise<void> {
  await api.delete(`/templates/${templateId}/stages/${stageId}`);
}

export async function setStageMachines(
  templateId: number,
  stageId: number,
  machineIds: number[],
): Promise<Stage> {
  return (
    await api.put<Stage>(`/templates/${templateId}/stages/${stageId}/machines`, {
      machine_ids: machineIds,
    })
  ).data;
}

export async function addField(
  templateId: number,
  stageId: number,
  payload: FieldDefCreate,
): Promise<FieldDef> {
  return (await api.post<FieldDef>(`/templates/${templateId}/stages/${stageId}/fields`, payload))
    .data;
}

export async function deleteField(
  templateId: number,
  stageId: number,
  fieldId: number,
): Promise<void> {
  await api.delete(`/templates/${templateId}/stages/${stageId}/fields/${fieldId}`);
}
