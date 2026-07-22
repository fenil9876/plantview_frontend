import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { apiErrorMessage } from "../lib/api";
import {
  createColor,
  createDesign,
  deleteColor,
  deleteDesign,
  listColors,
  listDesigns,
  updateColor,
  updateDesign,
} from "../lib/designApi";
import { useAuth } from "../auth/AuthContext";
import type { Color, Design } from "../lib/types";
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SkeletonList,
  useConfirm,
  useToast,
  type Column,
} from "../components/ui";

function Swatch({ hex }: { hex: string | null }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-slate-300 align-middle"
      style={{ background: hex ?? "transparent" }}
    />
  );
}

export function DesignPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "operator");
  const { confirm, dialog } = useConfirm();

  const colors = useQuery({ queryKey: ["colors"], queryFn: listColors });
  const designs = useQuery({ queryKey: ["designs"], queryFn: listDesigns });

  const invColors = () => qc.invalidateQueries({ queryKey: ["colors"] });
  const invDesigns = () => qc.invalidateQueries({ queryKey: ["designs"] });
  const fail = (e: unknown) => toast.error(apiErrorMessage(e));

  // create forms
  const [cName, setCName] = useState("");
  const [cHex, setCHex] = useState("#4f46e5");
  const [dName, setDName] = useState("");
  const [dDesc, setDDesc] = useState("");

  // edit targets
  const [editColor, setEditColor] = useState<Color | null>(null);
  const [editDesign, setEditDesign] = useState<Design | null>(null);

  const createColorMut = useMutation({
    mutationFn: () => createColor({ name: cName.trim(), hex: cHex }),
    onSuccess: () => {
      setCName("");
      toast.success("Color added");
      invColors();
    },
    onError: fail,
  });
  const deleteColorMut = useMutation({
    mutationFn: (id: number) => deleteColor(id),
    onSuccess: () => {
      toast.success("Color deleted");
      invColors();
    },
    onError: fail,
  });

  const createDesignMut = useMutation({
    mutationFn: () =>
      createDesign({ name: dName.trim(), description: dDesc.trim() || null }),
    onSuccess: () => {
      setDName("");
      setDDesc("");
      toast.success("Design added");
      invDesigns();
    },
    onError: fail,
  });
  const deleteDesignMut = useMutation({
    mutationFn: (id: number) => deleteDesign(id),
    onSuccess: () => {
      toast.success("Design deleted");
      invDesigns();
    },
    onError: fail,
  });

  const colorColumns: Column<Color>[] = [
    {
      header: "Color",
      cell: (c) => (
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <Swatch hex={c.hex} /> {c.name}
        </span>
      ),
    },
    { header: "Hex", cell: (c) => <span className="text-slate-500">{c.hex ?? "—"}</span> },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right",
            cell: (c: Color) => (
              <RowActions
                onEdit={() => setEditColor(c)}
                onDelete={() =>
                  confirm({
                    title: "Delete color",
                    message: `Delete color "${c.name}"?`,
                    onConfirm: () => deleteColorMut.mutate(c.id),
                  })
                }
              />
            ),
          } as Column<Color>,
        ]
      : []),
  ];

  const designColumns: Column<Design>[] = [
    { header: "Design", cell: (d) => <span className="font-medium text-slate-800">{d.name}</span> },
    { header: "Description", cell: (d) => <span className="text-slate-500">{d.description ?? "—"}</span> },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right",
            cell: (d: Design) => (
              <RowActions
                onEdit={() => setEditDesign(d)}
                onDelete={() =>
                  confirm({
                    title: "Delete design",
                    message: `Delete design "${d.name}"?`,
                    onConfirm: () => deleteDesignMut.mutate(d.id),
                  })
                }
              />
            ),
          } as Column<Design>,
        ]
      : []),
  ];

  const onAddColor = (e: FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return toast.error("Color name is required");
    createColorMut.mutate();
  };
  const onAddDesign = (e: FormEvent) => {
    e.preventDefault();
    if (!dName.trim()) return toast.error("Design name is required");
    createDesignMut.mutate();
  };

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader title="Design" subtitle="Manage your colors and designs." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Colors */}
        <div className="space-y-4">
          {canWrite && (
            <Card title="Add color">
              <form onSubmit={onAddColor} className="flex flex-wrap items-end gap-3">
                <Field label="Name" className="min-w-[8rem] flex-1">
                  <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Red" />
                </Field>
                <Field label="Color">
                  <input
                    type="color"
                    value={cHex}
                    onChange={(e) => setCHex(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-slate-300 sm:h-10"
                  />
                </Field>
                <Button type="submit" loading={createColorMut.isPending}>
                  Add
                </Button>
              </form>
            </Card>
          )}
          {colors.isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <DataTable columns={colorColumns} data={colors.data ?? []} rowKey={(c) => c.id} empty="No colors yet." />
          )}
        </div>

        {/* Designs */}
        <div className="space-y-4">
          {canWrite && (
            <Card title="Add design">
              <form onSubmit={onAddDesign} className="space-y-3">
                <Field label="Name">
                  <Input value={dName} onChange={(e) => setDName(e.target.value)} placeholder="Floral" />
                </Field>
                <Field label="Description" hint="optional">
                  <Input value={dDesc} onChange={(e) => setDDesc(e.target.value)} />
                </Field>
                <Button type="submit" loading={createDesignMut.isPending}>
                  Add design
                </Button>
              </form>
            </Card>
          )}
          {designs.isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <DataTable columns={designColumns} data={designs.data ?? []} rowKey={(d) => d.id} empty="No designs yet." />
          )}
        </div>
      </div>

      {editColor && (
        <ColorEditModal color={editColor} onClose={() => setEditColor(null)} onSaved={invColors} />
      )}
      {editDesign && (
        <DesignEditModal design={editDesign} onClose={() => setEditDesign(null)} onSaved={invDesigns} />
      )}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

function ColorEditModal({ color, onClose, onSaved }: { color: Color; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex ?? "#4f46e5");

  const mut = useMutation({
    mutationFn: () => updateColor(color.id, { name: name.trim(), hex }),
    onSuccess: () => {
      toast.success("Color updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit color"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex items-end gap-3">
        <Field label="Name" className="min-w-[8rem] flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Color">
          <input
            type="color"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border border-slate-300 sm:h-10"
          />
        </Field>
      </div>
    </Modal>
  );
}

function DesignEditModal({
  design,
  onClose,
  onSaved,
}: {
  design: Design;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(design.name);
  const [desc, setDesc] = useState(design.description ?? "");

  const mut = useMutation({
    mutationFn: () => updateDesign(design.id, { name: name.trim(), description: desc.trim() || null }),
    onSuccess: () => {
      toast.success("Design updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit design"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
