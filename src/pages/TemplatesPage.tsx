import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { deleteTemplate, listTemplates, updateTemplate } from "../lib/templatesApi";
import type { TemplateSummary } from "../lib/types";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

export function TemplatesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const { data: templates, isLoading } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["templates"] });

  const toggleMut = useMutation({
    mutationFn: (t: TemplateSummary) => updateTemplate(t.id, { is_active: !t.is_active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: Column<TemplateSummary>[] = [
    {
      header: "Name",
      cell: (t) => (
        <div>
          <Link to={`/templates/${t.id}`} className="font-medium text-brand hover:underline">
            {t.name}
          </Link>
          {t.description && <div className="text-xs text-slate-400">{t.description}</div>}
        </div>
      ),
    },
    { header: "Version", cell: (t) => <span className="text-slate-500">v{t.version}</span> },
    {
      header: "Status",
      cell: (t) => <Badge tone={t.is_active ? "green" : "gray"}>{t.is_active ? "active" : "inactive"}</Badge>,
    },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => toggleMut.mutate(t)}>
            {t.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              confirm({
                title: "Delete template",
                message: `Are you sure you want to delete "${t.name}"? This action cannot be undone.`,
                onConfirm: () => deleteMut.mutate(t.id),
              })
            }
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        title="Templates"
        subtitle="Define the stages and columns operators fill in for each process."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate("/templates/new")}>
            New template
          </Button>
        }
      />

      {isLoading ? (
        <Spinner label="Loading templates…" />
      ) : templates && templates.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="No templates yet"
          description="Create your first template to define a process and start recording batches."
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate("/templates/new")}>
              New template
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={templates ?? []} rowKey={(t) => t.id} />
      )}
    </div>
  );
}
