import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex h-full items-center justify-center gap-3 p-10 text-slate-500", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/**
 * Grey placeholder block with a sweep across it. Preferred over a centred
 * spinner for anything that loads into a known shape: the page keeps its
 * layout, so nothing jumps under the user's thumb when the data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-slate-200/70", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/** A stack of skeleton rows shaped like a list of cards. */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-full max-w-[16rem]" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <div className="min-w-0 break-words">{message}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
