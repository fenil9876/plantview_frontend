import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

interface Props {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loading && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={() => !loading && onCancel()}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "w-full rounded-t-3xl bg-white p-5 shadow-pop animate-sheet-up",
          "pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]",
          "sm:max-w-sm sm:rounded-2xl sm:p-6 sm:pb-6 sm:animate-scale-in",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full",
              danger ? "bg-red-100 text-red-600" : "bg-brand-100 text-brand-800",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
        </div>

        {/* Stacked and full-width on a phone: two small side-by-side buttons is
            where destructive mis-taps happen. Confirm sits on top, under the
            thumb, and Cancel is the wider, calmer target below it. */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading} className="sm:w-auto">
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            className="sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

/** Imperative confirm: call `confirm({...})`, render `dialog` in the tree. */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => setOpts(o), []);
  const close = useCallback(() => setOpts(null), []);

  const dialog = (
    <ConfirmDialog
      open={!!opts}
      title={opts?.title}
      message={opts?.message ?? ""}
      confirmLabel={opts?.confirmLabel}
      danger={opts?.danger ?? true}
      onCancel={close}
      onConfirm={() => {
        opts?.onConfirm();
        close();
      }}
    />
  );

  return { confirm, dialog };
}
