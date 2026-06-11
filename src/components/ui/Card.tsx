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
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-card", className)}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
