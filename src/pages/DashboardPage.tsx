import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, ClipboardList, Layers, PackageSearch } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiErrorMessage } from "../lib/api";
import {
  getBatchesByStatus,
  getBatchesByTemplate,
  getBatchesTimeseries,
  getMachineActivity,
  getOverview,
} from "../lib/analyticsApi";
import { Card, ErrorBanner, PageHeader, Skeleton, cn } from "../components/ui";
import { FieldExplorer } from "../components/FieldExplorer";

// Chart ink, drawn from the same palette as the rest of the app.
const SERIES = ["#0f766e", "#f59e0b", "#0891b2", "#7c3aed", "#059669", "#64748b"];

// Status slices reuse the badge colours, so a glance at the pie and a glance at
// a row in the batch list mean the same thing.
const STATUS_COLORS: Record<string, string> = {
  "in progress": "#2563eb",
  running: "#2563eb",
  completed: "#059669",
  cancelled: "#94a3b8",
};

const axis = { fontSize: 11, stroke: "#94a3b8", tickLine: false, axisLine: false } as const;

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 40px -8px rgb(15 23 42 / 0.2)",
    fontSize: 13,
  },
  cursor: { fill: "rgb(15 118 110 / 0.06)" },
} as const;

function KpiCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      {/* Stacked on a phone (two per row stay readable), side-by-side on wider
          screens where there is horizontal room to spare. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tint)}>{icon}</div>
        <div className="min-w-0">
          <div className="tabular text-2xl font-bold leading-none text-slate-900">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">No data yet.</div>
  );
}

/** Compact legend — readable on a phone, unlike slice labels on a small pie. */
function Legend({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
          <span className="capitalize">{i.name}</span>
          <span className="tabular font-semibold text-slate-900">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-[240px] w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [interval, setInterval] = useState<"day" | "week" | "month">("day");

  const overview = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const byStatus = useQuery({ queryKey: ["an", "by-status"], queryFn: getBatchesByStatus });
  const byTemplate = useQuery({ queryKey: ["an", "by-template"], queryFn: getBatchesByTemplate });
  const timeseries = useQuery({
    queryKey: ["an", "timeseries", interval],
    queryFn: () => getBatchesTimeseries(interval),
  });
  const machineActivity = useQuery({ queryKey: ["an", "machines"], queryFn: getMachineActivity });

  if (overview.error) return <ErrorBanner message={apiErrorMessage(overview.error)} />;

  const ov = overview.data;
  const statusData = (byStatus.data ?? []).map((s, i) => {
    const name = s.status.replace(/_/g, " ");
    return { name, value: s.count, color: STATUS_COLORS[name] ?? SERIES[i % SERIES.length] };
  });
  const templateData = (byTemplate.data ?? []).map((t) => ({ name: t.template_name, value: t.count }));
  const tsData = (timeseries.data ?? []).map((p) => ({
    name: new Date(p.period).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    value: p.count,
  }));
  const machineData = (machineActivity.data ?? []).map((m) => ({ name: m.machine_name, value: m.entries }));

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="An overview of your operations." />

      {/* Two per row on a phone: four stacked cards would push the charts a
          full screen down. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {ov ? (
          <>
            <KpiCard
              label="Templates"
              value={ov.templates_total}
              tint="bg-brand-50 text-brand"
              icon={<Layers className="h-5 w-5" />}
            />
            <KpiCard
              label="Active machines"
              value={ov.machines_active}
              tint="bg-emerald-50 text-emerald-600"
              icon={<Boxes className="h-5 w-5" />}
            />
            <KpiCard
              label="Batches"
              value={ov.batches_total}
              tint="bg-accent-50 text-accent-700"
              icon={<PackageSearch className="h-5 w-5" />}
            />
            <KpiCard
              label="Stage entries"
              value={ov.stage_entries_total}
              tint="bg-violet-50 text-violet-600"
              icon={<ClipboardList className="h-5 w-5" />}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-2.5 h-6 w-14" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))
        )}
      </div>

      {overview.isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Batches by status">
            {statusData.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    {/* No slice labels: on a 360px screen they overlap and get
                        clipped. The legend below carries the same information. */}
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusData.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <Legend items={statusData} />
              </>
            ) : (
              <Empty />
            )}
          </Card>

          <Card
            title="Batches over time"
            actions={
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(["day", "week", "month"] as const).map((i) => (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    aria-pressed={interval === i}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      interval === i
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            }
          >
            {tsData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={tsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" {...axis} minTickGap={16} />
                  <YAxis {...axis} allowDecimals={false} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Batches"
                    stroke="#0f766e"
                    fill="url(#areaFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </Card>

          <Card title="Batches by template">
            {templateData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={templateData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" {...axis} interval={0} tickMargin={6} />
                  <YAxis {...axis} allowDecimals={false} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Batches" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </Card>

          <Card title="Machine activity" subtitle="Stage entries recorded per machine">
            {machineData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={machineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" {...axis} interval={0} tickMargin={6} />
                  <YAxis {...axis} allowDecimals={false} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Entries" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </Card>
        </div>
      )}

      <FieldExplorer />
    </div>
  );
}
