import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "gray" | "blue" | "green" | "red" | "amber" | "indigo";

const TONES: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export function Badge({
  children,
  tone = "gray",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const BATCH_TONES: Record<string, BadgeTone> = {
  in_progress: "blue",
  completed: "green",
  cancelled: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={BATCH_TONES[status] ?? "gray"}>{status.replace(/_/g, " ")}</Badge>;
}
