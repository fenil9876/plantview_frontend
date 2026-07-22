import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, actions, backTo, backLabel = "Back" }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {backTo && (
          // Generous vertical padding: this is the most-tapped link in the app
          // and a bare 14px text link is a poor touch target.
          <Link
            to={backTo}
            className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-lg py-1.5 pl-1 pr-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {/* Wraps rather than overflowing: some pages pass four buttons plus a
          status badge, which will not fit on one phone-width line. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
