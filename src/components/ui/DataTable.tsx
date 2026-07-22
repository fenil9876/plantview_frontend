import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Card heading on mobile. Defaults to the first column. */
  primary?: boolean;
  /** Pin to the card's top-right on mobile. Header-less columns do this anyway. */
  action?: boolean;
  /** Drop from the mobile card entirely — for low-value columns. */
  hideOnMobile?: boolean;
  /** Overrides the header text as the mobile row label. */
  mobileLabel?: ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

const isBlank = (n: ReactNode) => n === "" || n === null || n === undefined;

/**
 * A real table from `md` up; a stack of cards below it.
 *
 * The mobile cards are derived from the same column definitions, so no call
 * site has to describe its layout twice. Horizontally scrolling a table on a
 * phone hides exactly the column people came to check (status), which is why
 * the small-screen branch exists at all.
 */
export function DataTable<T>({ columns, data, rowKey, empty, onRowClick, className }: Props<T>) {
  const actionCols = columns.filter((c) => c.action || isBlank(c.header));
  const contentCols = columns.filter((c) => !actionCols.includes(c) && !c.hideOnMobile);
  const primary = contentCols.find((c) => c.primary) ?? contentCols[0];
  const detailCols = contentCols.filter((c) => c !== primary);

  const emptyNode = (
    <div className="px-4 py-10 text-center text-sm text-slate-500">{empty ?? "Nothing here yet."}</div>
  );

  return (
    <div className={className}>
      {/* ---- Mobile: card list ---- */}
      <div className="space-y-2 md:hidden">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">{emptyNode}</div>
        ) : (
          data.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition-colors",
                onRowClick && "cursor-pointer active:bg-slate-50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900">
                  {primary?.cell(row)}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {actionCols.map((c, i) => (
                    <div key={i}>{c.cell(row)}</div>
                  ))}
                  {onRowClick && actionCols.length === 0 && (
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  )}
                </div>
              </div>

              {detailCols.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {detailCols.map((c, i) => (
                    <div key={i} className="contents">
                      <dt className="text-slate-500">{c.mobileLabel ?? c.header}</dt>
                      <dd className="min-w-0 text-right text-slate-800">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))
        )}
      </div>

      {/* ---- Desktop: table ---- */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              {columns.map((c, i) => (
                <th key={i} className={cn("px-4 py-3 font-semibold", c.align && alignClass[c.align])}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{emptyNode}</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-slate-100 last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-brand-50/50",
                  )}
                >
                  {columns.map((c, i) => (
                    <td
                      key={i}
                      className={cn("px-4 py-3 text-slate-700", c.align && alignClass[c.align], c.className)}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
