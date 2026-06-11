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
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
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
  const submitting = editing ? updateMut.isPending : createMut.isPending;

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        title="Inventory"
        subtitle="Raw materials on hand (kg)."
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add material
            </Button>
          ) : undefined
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Materials</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-800">{list.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Total stock</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-800">
            {totalStock} <span className="text-base font-medium text-slate-400">kg</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Spinner label="Loading inventory…" />
      ) : list.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
            <Warehouse className="h-8 w-8 text-slate-300" />
            <p className="text-sm">No materials yet.</p>
            {canWrite && (
              <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
                Add your first material
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Material</th>
                  <th className="px-5 py-3 font-semibold">In stock</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Last updated</th>
                  {canWrite && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                          <Boxes className="h-[18px] w-[18px]" />
                        </span>
                        <span className="font-medium text-slate-800">{i.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-base font-semibold text-slate-900">{i.quantity}</span>{" "}
                      <span className="text-slate-400">{i.unit}</span>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-400 md:table-cell">
                      {new Date(i.updated_at).toLocaleString()}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Pencil className="h-4 w-4" />}
                            onClick={() => openEdit(i)}
                          >
                            Update
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${i.name}`}
                            onClick={() =>
                              confirm({
                                title: "Delete material",
                                message: `Are you sure you want to delete "${i.name}" from inventory? This cannot be undone.`,
                                confirmLabel: "Delete",
                                onConfirm: () => deleteMut.mutate(i.id),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Update material" : "Add material"}
        description={editing ? `Editing "${editing.name}"` : "Add a new raw material to inventory."}
      >
        <ItemForm
          key={editing?.id ?? "new"}
          initial={editing}
          submitting={submitting}
          onCancel={closeForm}
          onSubmit={(v) =>
            editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v)
          }
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
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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
