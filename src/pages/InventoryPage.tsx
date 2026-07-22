import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from "../lib/inventoryApi";
import { useAuth } from "../auth/AuthContext";
import type { InventoryItem } from "../lib/types";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorBanner,
  Fab,
  Field,
  Input,
  Modal,
  PageHeader,
  SkeletonList,
  cn,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function InventoryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "operator");
  const { confirm, dialog } = useConfirm();

  const { data: items, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: listInventory });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["inventory"] });
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const createMut = useMutation({
    mutationFn: (v: { name: string; quantity: number }) => createInventoryItem(v),
    onSuccess: () => {
      toast.success("Material added");
      invalidate();
      closeForm();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: number; name: string; quantity: number }) =>
      updateInventoryItem(v.id, { name: v.name, quantity: v.quantity }),
    onSuccess: () => {
      toast.success("Material updated");
      invalidate();
      closeForm();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteInventoryItem(id),
    onSuccess: () => {
      toast.success("Material deleted");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const list = items ?? [];
  const totalStock = round2(list.reduce((s, i) => s + i.quantity, 0));
  const outOfStock = list.filter((i) => i.quantity <= 0).length;
  const submitting = editing ? updateMut.isPending : createMut.isPending;

  const columns: Column<InventoryItem>[] = [
    {
      header: "Material",
      primary: true,
      cell: (i) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
            <Boxes className="h-[18px] w-[18px]" />
          </span>
          <span className="font-semibold text-slate-900">{i.name}</span>
        </div>
      ),
    },
    {
      header: "In stock",
      cell: (i) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {/* Zero stock is the one number on this page that must jump out — it
              blocks production the moment someone tries to consume it. */}
          <span
            className={cn(
              "tabular text-base font-semibold",
              i.quantity <= 0 ? "text-red-600" : "text-slate-900",
            )}
          >
            {i.quantity}
          </span>
          <span className="text-slate-500">{i.unit}</span>
          {i.quantity <= 0 && <Badge tone="red">Out of stock</Badge>}
        </span>
      ),
    },
    {
      header: "Last updated",
      mobileLabel: "Updated",
      cell: (i) => (
        <span className="tabular text-slate-500">{new Date(i.updated_at).toLocaleString()}</span>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right" as const,
            cell: (i: InventoryItem) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Update ${i.name}`}
                  className="text-slate-500 hover:text-brand"
                  onClick={() => openEdit(i)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${i.name}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() =>
                    confirm({
                      title: "Delete material",
                      message: `Remove “${i.name}” from inventory? This cannot be undone.`,
                      confirmLabel: "Delete",
                      onConfirm: () => deleteMut.mutate(i.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader
        title="Inventory"
        subtitle="Raw materials on hand (kg)."
        actions={
          canWrite ? (
            <Button
              className="hidden sm:inline-flex"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={openAdd}
            >
              Add material
            </Button>
          ) : undefined
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-lg lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Materials</div>
          <div className="tabular mt-0.5 text-2xl font-bold text-slate-900">{list.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Total stock</div>
          <div className="tabular mt-0.5 text-2xl font-bold text-slate-900">
            {totalStock} <span className="text-base font-medium text-slate-500">kg</span>
          </div>
        </div>
        <div
          className={cn(
            "col-span-2 rounded-2xl border px-4 py-3 shadow-card lg:col-span-1",
            outOfStock > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white",
          )}
        >
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              outOfStock > 0 ? "text-red-700" : "text-slate-500",
            )}
          >
            Out of stock
          </div>
          <div
            className={cn(
              "tabular mt-0.5 text-2xl font-bold",
              outOfStock > 0 ? "text-red-700" : "text-slate-900",
            )}
          >
            {outOfStock}
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-6 w-6" />}
          title="No materials yet"
          description="Add the raw materials your batches consume so stock is deducted automatically."
          action={
            canWrite ? (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
                Add your first material
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={list} rowKey={(i) => i.id} />
      )}

      {canWrite && <Fab onClick={openAdd} icon={<Plus className="h-5 w-5" />} label="Add material" />}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Update material" : "Add material"}
        description={editing ? `Editing “${editing.name}”` : "Add a new raw material to inventory."}
        size="sm"
      >
        <ItemForm
          key={editing?.id ?? "new"}
          initial={editing}
          submitting={submitting}
          onCancel={closeForm}
          onSubmit={(v) => (editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v))}
        />
      </Modal>
    </div>
  );
}

function ItemForm({
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial: InventoryItem | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (v: { name: string; quantity: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(initial != null ? String(initial.quantity) : "");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const n = name.trim();
    const q = Number(quantity);
    if (!n) return setErr("Material name is required.");
    if (quantity.trim() === "" || Number.isNaN(q) || q < 0)
      return setErr("Enter a valid quantity (0 or more).");
    setErr(null);
    onSubmit({ name: n, quantity: q });
  };

  return (
    <div className="space-y-4">
      {err && <ErrorBanner message={err} />}
      <Field label="Material name" required>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Cotton Yarn" />
      </Field>
      <Field label="Quantity (kg)" required>
        <Input
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={submitting} onClick={submit}>
          {initial ? "Save changes" : "Add material"}
        </Button>
      </div>
    </div>
  );
}
