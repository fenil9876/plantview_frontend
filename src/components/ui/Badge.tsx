import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "gray" | "blue" | "green" | "red" | "amber" | "indigo" | "teal";

// Every pairing below clears 4.5:1 — chips are small text, so the tint has to
// stay light and the ink has to stay dark.
const TONES: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  amber: "bg-accent-50 text-accent-800 ring-accent-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  teal: "bg-brand-50 text-brand-800 ring-brand-200",
};

const DOTS: Record<BadgeTone, string> = {
  gray: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-accent-500",
  indigo: "bg-indigo-500",
  teal: "bg-brand-500",
};

export function Badge({
  children,
  tone = "gray",
  dot,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /** Leading status dot — readable at a glance and not colour-only. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5",
        "text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

const BATCH_TONES: Record<string, BadgeTone> = {
  in_progress: "blue",
  completed: "green",
  cancelled: "gray",
};

// "in_progress" is jargon on a screen an operator reads a hundred times a day.
const BATCH_LABELS: Record<string, string> = {
  in_progress: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={BATCH_TONES[status] ?? "gray"} dot>
      {BATCH_LABELS[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
