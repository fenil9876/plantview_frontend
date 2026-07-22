import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  Clock,
  Gauge,
  Layers,
  Table2,
  TrendingDown,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getBatch } from "../lib/batchesApi";
import { getTemplate } from "../lib/templatesApi";
import { listMachines } from "../lib/machinesApi";
import { analyseLot, round2, type SkuProgress } from "../lib/lotAnalytics";
import { Badge, Button, Card, cn, EmptyState, PageHeader, Spinner } from "../components/ui";

/* --------------------------------------------------------------------------
 * Visual tokens.
 *
 * Series blue and the 5-step ramp were validated against this app's white card
 * surface (single hue, monotone lightness, all step gaps >= 0.06, light end
 * 2.11:1). In-cell ink is chosen per step so every label clears 4:1.
 * Product colours are the exception: a "Black" series drawn in blue would be
 * nonsense to the floor, so those marks use the real colour hex and identity is
 * always carried by an adjacent text label, never by the swatch alone.
 * ----------------------------------------------------------------------- */
const SERIES = "#2a78d6";
const SERIES_MUTED = "#c3c2b7";
const GRID = "#e1e0d9";
const AXIS = "#898781";
const RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const RAMP_INK = ["#0f172a", "#0f172a", "#ffffff", "#ffffff", "#ffffff"];
const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

const nf = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Bin a percentage onto the validated ramp. Returns -1 for "nothing here". */
function bin(pct: number): number {
  if (pct <= 0) return -1;
  if (pct <= 25) return 0;
  if (pct <= 50) return 1;
  if (pct <= 75) return 2;
  if (pct < 100) return 3;
  return 4;
}

const STATUS_META: Record<
  SkuProgress["status"],
  { label: string; color: string; icon: typeof CheckCircle2; tone: string }
> = {
  done: { label: "Complete", color: STATUS.good, icon: CheckCircle2, tone: "bg-green-100 text-green-700" },
  on_track: { label: "On track", color: SERIES, icon: Gauge, tone: "bg-blue-100 text-blue-700" },
  behind: { label: "Behind", color: STATUS.warning, icon: TrendingDown, tone: "bg-amber-100 text-amber-700" },
  stalled: { label: "Stalled", color: STATUS.critical, icon: AlertTriangle, tone: "bg-red-100 text-red-700" },
  not_started: { label: "Not started", color: SERIES_MUTED, icon: CircleDashed, tone: "bg-slate-100 text-slate-600" },
};

/** A product colour swatch. Ringed so white/near-surface colours stay visible. */
function Swatch({ hex, className }: { hex: string | null; className?: string }) {
  return (
    <span
      className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-300", className)}
      style={{ background: hex ?? "transparent" }}
    />
  );
}

export function LotAnalyticsPage() {
  const { id } = useParams();
  const batchId = Number(id);

  const { data: batch, isLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => getBatch(batchId),
  });
  const { data: template } = useQuery({
    queryKey: ["template", batch?.template_id],
    queryFn: () => getTemplate(batch!.template_id),
    enabled: !!batch,
  });
  const { data: machines } = useQuery({ queryKey: ["machines"], queryFn: listMachines });

  const [designFilter, setDesignFilter] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const a = useMemo(
    () => (batch && template ? analyseLot(batch, template, machines ?? [], designFilter) : null),
    [batch, template, machines, designFilter],
  );

  if (isLoading || !batch || !template || !a) return <Spinner label="Crunching the numbers…" />;

  const hasData = a.totalEntries > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${batch.code} — analytics`}
        backTo={`/batches/${batchId}`}
        backLabel={batch.code}
        subtitle={
          <>
            {template.name} · {a.totalEntries} entries across {a.stages.length} stages
            {a.daysActive > 0 && ` · ${a.daysActive} active days`}
          </>
        }
      />

      {/* One filter row above everything it scopes. */}
      {batch.designs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Design</span>
          <button
            type="button"
            onClick={() => setDesignFilter(null)}
            aria-pressed={designFilter === null}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              designFilter === null
                ? "border-brand bg-brand-50 text-brand"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand",
            )}
          >
            All designs
          </button>
          {batch.designs.map((d) => (
            <button
              key={d.design_id}
              type="button"
              onClick={() => setDesignFilter(d.design_id)}
              aria-pressed={designFilter === d.design_id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                designFilter === d.design_id
                  ? "border-brand bg-brand-50 text-brand"
                  : "border-slate-300 bg-white text-slate-600 hover:border-brand",
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {!hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Nothing to analyse yet"
          description="Once operators record entries against this lot, the numbers appear here."
        />
      ) : (
        <>
          <Headline a={a} />
          <StageFunnel a={a} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SkuProgressCard a={a} />
            <FlowOverTime a={a} />
          </div>
          <SkuStageMatrix a={a} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
          {a.machines.length > 0 && <MachineOutput a={a} />}
        </>
      )}
    </div>
  );
}

type A = NonNullable<ReturnType<typeof analyseLot>>;

/* ---------------------------- headline + KPIs ---------------------------- */

function Headline({ a }: { a: A }) {
  const pct = a.completionPct ?? 0;
  const meterColor = pct >= 100 ? STATUS.good : pct >= 60 ? SERIES : pct >= 30 ? STATUS.warning : STATUS.critical;

  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Hero figure — the one number this page leads with. */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lot completion
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">
              {nf(pct)}%
            </span>
            <span className="text-sm text-slate-500">
              {nf(a.completed)} of {nf(a.target)}
            </span>
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: `${meterColor}2e` }}
            role="img"
            aria-label={`${nf(pct)} percent complete`}
          >
            <div
              className="h-full rounded-r"
              style={{ width: `${Math.min(100, pct)}%`, background: meterColor }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Measured at <strong className="text-slate-700">{a.final?.name}</strong>, the final stage.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="In the line" value={nf(a.wip)} hint="Started, not yet finished" />
          <Kpi
            label="Throughput yield"
            value={a.yieldPct != null ? `${nf(a.yieldPct)}%` : "—"}
            hint={`Of units started at ${a.first?.name}`}
          />
          <Kpi
            label="Avg output / day"
            value={a.dailyRate != null ? nf(a.dailyRate) : "—"}
            hint={`Over ${a.daysActive} active days`}
          />
          <Kpi
            label="Projected finish"
            value={
              a.projectedFinish
                ? a.projectedFinish.toLocaleDateString(undefined, { day: "numeric", month: "short" })
                : a.completed > 0 && a.completionPct != null && a.completionPct >= 100
                  ? "Done"
                  : "—"
            }
            hint={a.daysRemaining != null ? `~${a.daysRemaining} days at current pace` : "Needs more data"}
          />
        </div>
      </div>

      {a.bottleneck && a.bottleneck.lostFromPrev != null && a.bottleneck.lostFromPrev > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: STATUS.critical }} />
          <p className="text-sm text-slate-700">
            <strong className="font-semibold text-slate-900">{a.bottleneck.name}</strong> is the
            bottleneck — {nf(a.bottleneck.lostFromPrev)} units reached it but have not come out
            {a.bottleneck.lostPctFromPrev != null && ` (${nf(a.bottleneck.lostPctFromPrev)}% of what arrived)`}.
            Clearing it is the single biggest lever on this lot.
          </p>
        </div>
      )}
    </Card>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-slate-500">{hint}</div>
    </div>
  );
}

/* ------------------------------ stage funnel ----------------------------- */

/**
 * Where the units are. One hue for every stage with the bottleneck pulled out in
 * the critical token — emphasis, so the eye lands on the stage worth acting on.
 */
function StageFunnel({ a }: { a: A }) {
  const max = Math.max(...a.stages.map((s) => s.total), 1);

  return (
    <Card
      title="Stage flow"
      subtitle="Units recorded at each stage, in production order. The step down between bars is what the line lost."
    >
      <div className="space-y-3">
        {a.stages.map((s, i) => {
          const w = (s.total / max) * 100;
          const color = s.isBottleneck ? STATUS.critical : SERIES;
          const prevName = i > 0 ? a.stages[i - 1].name : null;
          return (
            <div key={s.stageId}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  {s.index + 1}. {s.name}
                  {s.isBottleneck && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                      title="Largest unit loss between two stages"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Bottleneck
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {s.lostFromPrev != null && s.lostFromPrev > 0 ? (
                    <>
                      −{nf(s.lostFromPrev)} vs {prevName}
                    </>
                  ) : s.lostFromPrev != null && s.lostFromPrev < 0 ? (
                    <>+{nf(-s.lostFromPrev)} vs previous</>
                  ) : (
                    `${s.entries} entries`
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 min-w-0 flex-1 rounded-sm bg-slate-100">
                  <div
                    className="h-full rounded-r"
                    style={{ width: `${Math.max(w, 1)}%`, background: color }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800 sm:w-16">
                  {nf(s.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------------------- per-SKU progress --------------------------- */

/** Plan vs actual for every design+colour, ranked worst-first so the problem leads. */
function SkuProgressCard({ a }: { a: A }) {
  const rows = [...a.progress].sort((x, y) => (x.donePct ?? 0) - (y.donePct ?? 0));

  return (
    <Card
      title="Design & colour progress"
      subtitle="Finished vs planned for each design/colour. Ranked worst first — the top row is where to look."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No designs planned for this lot.</p>
      ) : (
        <div className="space-y-3.5">
          {rows.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            const pct = r.donePct ?? 0;
            return (
              <div key={r.key}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Swatch hex={r.colorHex} />
                    {r.designName} · {r.colorName}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="text-sm tabular-nums text-slate-500">
                      <strong className="text-slate-800">{nf(r.done)}</strong> / {nf(r.planned)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
                    style={{ background: `${meta.color}2e` }}
                  >
                    <div
                      className="h-full rounded-r"
                      style={{ width: `${Math.min(100, pct)}%`, background: meta.color }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">
                    {nf(pct)}%
                  </span>
                </div>
                {r.vsAverage != null && Math.abs(r.vsAverage) >= 10 && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {r.vsAverage < 0 ? `${nf(-r.vsAverage)} pts behind` : `${nf(r.vsAverage)} pts ahead of`} the
                    lot average
                    {r.vsAverage < 0 && ` · ${nf(round2(r.planned - r.done))} still to make`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ flow in time ----------------------------- */

/**
 * Cumulative started vs finished. The vertical gap between the two lines is
 * work-in-progress — a widening gap means the line is filling up faster than it
 * empties, which is a pile-up you can see before it shows up as a late lot.
 */
function FlowOverTime({ a }: { a: A }) {
  if (a.timeline.length < 2) {
    return (
      <Card title="Flow over time" subtitle="Cumulative units started vs finished.">
        <p className="text-sm text-slate-500">
          Needs entries on at least two different days to plot a trend.
        </p>
      </Card>
    );
  }

  const startedLabel = a.first?.name ?? "Started";
  const finishedLabel = a.final?.name ?? "Finished";
  const last = a.timeline[a.timeline.length - 1];

  return (
    <Card
      title="Flow over time"
      subtitle={`Cumulative units. The gap between the lines is work still inside the line — currently ${nf(last.wip)}.`}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={a.timeline} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis dataKey="label" fontSize={12} stroke={AXIS} tickLine={false} />
            <YAxis fontSize={12} stroke={AXIS} tickLine={false} allowDecimals={false} width={44} />
            <Tooltip
              formatter={(v: number, name: string) => [nf(v), name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {a.target > 0 && (
              <ReferenceLine
                y={a.target}
                stroke={AXIS}
                strokeWidth={1}
                label={{ value: `Target ${nf(a.target)}`, position: "insideTopRight", fontSize: 11, fill: AXIS }}
              />
            )}
            <Line
              type="monotone"
              dataKey="started"
              name={startedLabel}
              stroke={SERIES_MUTED}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
            />
            <Line
              type="monotone"
              dataKey="finished"
              name={finishedLabel}
              stroke={SERIES}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------------------------- SKU × stage matrix ------------------------- */

/**
 * The whole lot on one grid: every design/colour down the side, every stage
 * across. Shade is progress against that SKU's own plan, so a row that goes pale
 * partway across is a SKU stuck at that stage.
 */
function SkuStageMatrix({
  a,
  showTable,
  onToggleTable,
}: {
  a: A;
  showTable: boolean;
  onToggleTable: () => void;
}) {
  const cell = (skuKey: string, stageIdx: number) => a.stages[stageIdx].bySku[skuKey] ?? 0;

  return (
    <Card
      title="Where every design & colour is stuck"
      subtitle="Each cell is units recorded at that stage; shading is progress against that colour's plan."
      actions={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={showTable ? <Layers className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          onClick={onToggleTable}
        >
          {showTable ? "Heatmap" : "Table"}
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Design · colour
              </th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plan
              </th>
              {a.stages.map((s) => (
                <th
                  key={s.stageId}
                  className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.progress.map((r) => (
              <tr key={r.key}>
                <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left font-medium text-slate-800">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Swatch hex={r.colorHex} />
                    {r.designName} · {r.colorName}
                  </span>
                </th>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{nf(r.planned)}</td>
                {a.stages.map((s, i) => {
                  const v = cell(r.key, i);
                  const pct = r.planned > 0 ? (v / r.planned) * 100 : 0;
                  const b = bin(pct);
                  const filled = b >= 0 && !showTable;
                  return (
                    <td
                      key={s.stageId}
                      title={`${r.designName} · ${r.colorName} — ${s.name}: ${nf(v)} of ${nf(
                        r.planned,
                      )} planned (${nf(round2(pct))}%)`}
                      className={cn(
                        "px-2 py-1.5 text-center tabular-nums",
                        filled ? "rounded font-semibold" : "text-slate-600",
                        !filled && b < 0 && "text-slate-300",
                        showTable && "border-b border-slate-100",
                      )}
                      style={
                        filled
                          ? { background: RAMP[b], color: RAMP_INK[b] }
                          : undefined
                      }
                    >
                      {v > 0 ? nf(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showTable && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Progress vs plan</span>
          <span className="flex items-center gap-1">
            {["1–25%", "26–50%", "51–75%", "76–99%", "100%"].map((label, i) => (
              <span key={label} className="flex items-center gap-1">
                <span className="inline-block h-3.5 w-6 rounded-sm" style={{ background: RAMP[i] }} />
                <span className="mr-1.5">{label}</span>
              </span>
            ))}
          </span>
          <span className="text-slate-500">— = nothing recorded</span>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------- machine output ---------------------------- */

/** Which machines actually carried the lot. One series, one colour, ranked. */
function MachineOutput({ a }: { a: A }) {
  const TOP = 10;
  const shown = a.machines.slice(0, TOP);
  const rest = a.machines.slice(TOP);
  const restQty = round2(rest.reduce((s, m) => s + m.qty, 0));
  const max = Math.max(...a.machines.map((m) => m.qty), 1);

  return (
    <Card
      title="Machine output"
      subtitle={`Units recorded per machine across all machine stages${
        rest.length ? ` · top ${TOP} of ${a.machines.length}` : ""
      }.`}
    >
      <div className="space-y-2.5">
        {shown.map((m) => (
          <div
            key={m.machineId}
            className="flex items-center gap-2 sm:gap-3"
            title={`${m.name} — ${nf(m.qty)} units · ${m.stageNames.join(", ")}`}
          >
            <span className="w-14 shrink-0 truncate text-sm font-medium text-slate-700 sm:w-24">
              {m.name}
            </span>
            <div className="h-5 min-w-0 flex-1 rounded-sm bg-slate-100">
              <div
                className="h-full rounded-r"
                style={{ width: `${Math.max((m.qty / max) * 100, 1)}%`, background: SERIES }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800 sm:w-14">
              {nf(m.qty)}
            </span>
            {/* Stage names would starve the bar on a phone; the row title keeps them. */}
            <Badge tone="gray" className="hidden shrink-0 sm:inline-flex">
              {m.stageNames.join(", ")}
            </Badge>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="flex items-center gap-2 pt-1 sm:gap-3">
            <span className="w-14 shrink-0 text-sm text-slate-500 sm:w-24">+{rest.length} more</span>
            <div className="h-5 min-w-0 flex-1 rounded-sm bg-slate-100">
              <div
                className="h-full rounded-r"
                style={{ width: `${Math.max((restQty / max) * 100, 1)}%`, background: SERIES_MUTED }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-500 sm:w-14">
              {nf(restQty)}
            </span>
            <Badge tone="gray" className="hidden shrink-0 sm:inline-flex">
              Other
            </Badge>
          </div>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        Output only — machines idle on this lot do not appear.
      </p>
    </Card>
  );
}
