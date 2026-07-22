import type { ReactNode } from "react";
import { cn } from "./cn";

interface Props {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function Card({ children, title, subtitle, actions, className, bodyClassName, noPadding }: Props) {
  const hasHeader = title || subtitle || actions;
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-card", className)}>
      {hasHeader && (
        // Header actions wrap under the title on narrow screens instead of
        // squeezing the heading down to two characters.
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
