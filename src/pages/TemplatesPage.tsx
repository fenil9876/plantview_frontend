import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Power, Trash2 } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import { deleteTemplate, listTemplates, updateTemplate } from "../lib/templatesApi";
import type { TemplateSummary } from "../lib/types";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Fab,
  PageHeader,
  SkeletonList,
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
      primary: true,
      cell: (t) => (
        <div className="min-w-0">
          <Link to={`/templates/${t.id}`} className="font-semibold text-brand hover:underline">
            {t.name}
          </Link>
          {t.description && <div className="text-xs font-normal text-slate-500">{t.description}</div>}
        </div>
      ),
    },
    { header: "Version", cell: (t) => <span className="tabular text-slate-600">v{t.version}</span> },
    {
      header: "Status",
      cell: (t) => (
        <Badge tone={t.is_active ? "green" : "gray"} dot>
          {t.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            title={t.is_active ? "Deactivate" : "Activate"}
            aria-label={`${t.is_active ? "Deactivate" : "Activate"} ${t.name}`}
            className={t.is_active ? "text-emerald-600 hover:text-slate-500" : "text-slate-400 hover:text-emerald-600"}
            loading={toggleMut.isPending && toggleMut.variables?.id === t.id}
            onClick={() => toggleMut.mutate(t)}
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Delete"
            aria-label={`Delete ${t.name}`}
            className="text-slate-400 hover:text-red-600"
            onClick={() =>
              confirm({
                title: "Delete template",
                message: `Delete “${t.name}”? This cannot be undone.`,
                onConfirm: () => deleteMut.mutate(t.id),
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const list = templates ?? [];

  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader
        title="Templates"
        subtitle="Define the stages and columns operators fill in for each process."
        actions={
          <Button
            className="hidden sm:inline-flex"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate("/templates/new")}
          >
            New template
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : list.length === 0 ? (
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
        <DataTable columns={columns} data={list} rowKey={(t) => t.id} />
      )}

      <Fab
        onClick={() => navigate("/templates/new")}
        icon={<Plus className="h-5 w-5" />}
        label="New template"
      />
    </div>
  );
}
