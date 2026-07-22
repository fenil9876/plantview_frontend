import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Floating action button — the page's single primary action, parked in the
 * bottom-right corner where a thumb naturally rests.
 *
 * Mobile only: on desktop the same action lives in the page header, where
 * there is room for a labelled button and no reachability problem to solve.
 * It sits above the bottom tab bar and clears the home indicator.
 */
export function Fab({
  onClick,
  icon,
  label,
  className,
}: {
  onClick: () => void;
  icon: ReactNode;
  /** Announced to screen readers, and shown next to the icon on wider phones. */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-white shadow-fab",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)]",
        // Hidden exactly where the labelled header button appears, so the same
        // action is never offered twice on one screen.
        "transition-transform active:scale-95 sm:hidden",
        className,
      )}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
