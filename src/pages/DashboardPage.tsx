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
import { Card, ErrorBanner, PageHeader, Spinner } from "../components/ui";
import { FieldExplorer } from "../components/FieldExplorer";

const COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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
    <Card>
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} actions={action}>
      {children}
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
      No data yet.
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

  if (overview.isLoading) return <Spinner label="Loading dashboard…" />;
  if (overview.error) return <ErrorBanner message={apiErrorMessage(overview.error)} />;

  const ov = overview.data!;
  const statusData = (byStatus.data ?? []).map((s) => ({ name: s.status.replace("_", " "), value: s.count }));
  const templateData = (byTemplate.data ?? []).map((t) => ({ name: t.template_name, value: t.count }));
  const tsData = (timeseries.data ?? []).map((p) => ({
    name: new Date(p.period).toLocaleDateString(),
    value: p.count,
  }));
  const machineData = (machineActivity.data ?? []).map((m) => ({ name: m.machine_name, value: m.entries }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="An overview of your operations." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Templates" value={ov.templates_total} tint="bg-brand-100 text-brand"
          icon={<Layers className="h-5 w-5" />} />
        <KpiCard label="Active machines" value={ov.machines_active} tint="bg-emerald-100 text-emerald-600"
          icon={<Boxes className="h-5 w-5" />} />
        <KpiCard label="Batches" value={ov.batches_total} tint="bg-amber-100 text-amber-600"
          icon={<PackageSearch className="h-5 w-5" />} />
        <KpiCard label="Stage entries" value={ov.stage_entries_total} tint="bg-violet-100 text-violet-600"
          icon={<ClipboardList className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Batches by status">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard
          title="Batches over time"
          action={
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
              {(["day", "week", "month"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    interval === i ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          }
        >
          {tsData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={tsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="#4f46e533" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Batches by template">
          {templateData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={templateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Machine activity (entries)">
          {machineData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={machineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>

      <FieldExplorer />
    </div>
  );
}
