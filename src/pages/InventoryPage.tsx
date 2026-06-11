import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, Warehouse } from "lucide-react";
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
  DataTable,
  Field,
  Input,
  PageHeader,
  Spinner,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

export function InventoryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "operator");
  const { confirm, dialog } = useConfirm();

  const { data: items, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: listInventory });

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["inventory"] });

  const createMut = useMutation({
    mutationFn: () =>
      createInventoryItem({ name: name.trim(), quantity: quantity ? Number(quantity) : 0 }),
    onSuccess: () => {
      setName("");
      setQuantity("");
      toast.success("Item added");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: number; quantity: number }) => updateInventoryItem(v.id, { quantity: v.quantity }),
    onSuccess: () => {
      toast.success("Quantity updated");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteInventoryItem(id),
    onSuccess: () => {
      toast.success("Item deleted");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Item name is required");
    createMut.mutate();
  };

  const columns: Column<InventoryItem>[] = [
    { header: "Material", cell: (i) => <span className="font-medium text-slate-800">{i.name}</span> },
    {
      header: "Quantity",
      cell: (i) =>
        canWrite ? (
          <QuantityEditor item={i} onSave={(q) => updateMut.mutate({ id: i.id, quantity: q })} />
        ) : (
          <span className="text-slate-700">
            {i.quantity} <span className="text-slate-400">{i.unit}</span>
          </span>
        ),
    },
    {
      header: "Updated",
      cell: (i) => <span className="text-slate-400">{new Date(i.updated_at).toLocaleString()}</span>,
    },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right",
            cell: (i: InventoryItem) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  confirm({
                    title: "Delete item",
                    message: `Are you sure you want to delete "${i.name}" from inventory?`,
                    onConfirm: () => deleteMut.mutate(i.id),
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            ),
          } as Column<InventoryItem>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader title="Inventory" subtitle="Raw materials on hand (kg)." />

      {canWrite && (
        <Card title="Add material">
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-4">
            <Field label="Material name" className="min-w-[220px] flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cotton Yarn" />
            </Field>
            <Field label="Quantity (kg)" className="w-40">
              <Input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Button type="submit" loading={createMut.isPending}>
              Add material
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Spinner label="Loading inventory…" />
      ) : (
        <DataTable
          columns={columns}
          data={items ?? []}
          rowKey={(i) => i.id}
          empty={
            <div className="flex flex-col items-center gap-1 py-4">
              <Warehouse className="h-6 w-6 text-slate-300" />
              No inventory yet.
            </div>
          }
        />
      )}
    </div>
  );
}

function QuantityEditor({ item, onSave }: { item: InventoryItem; onSave: (q: number) => void }) {
  const [value, setValue] = useState(String(item.quantity));
  const num = Number(value);
  const dirty = value.trim() !== "" && !Number.isNaN(num) && num !== item.quantity && num >= 0;

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 w-28"
      />
      <span className="text-sm text-slate-400">{item.unit}</span>
      {dirty && (
        <Button size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={() => onSave(num)}>
          Save
        </Button>
      )}
    </div>
  );
}
