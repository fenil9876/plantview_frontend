/**
 * Turns a lot's raw entries into the numbers a manager actually decides on:
 * where the line is losing units, which design/colour is falling behind, and
 * whether the lot is on pace to finish.
 *
 * Pure functions over what `getBatch` already returns — no extra endpoints.
 */
import type { BatchRead, Machine, Stage, StageEntry, TemplateRead } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quantity on one entry: summed machine quantities, else the built-in stage field. */
export function entryQuantity(stage: Stage, e: StageEntry): number {
  if (stage.has_machines) {
    return e.machine_entries.reduce((s, me) => s + (me.quantity ?? 0), 0);
  }
  const q = Number(e.data["quantity"]);
  return Number.isFinite(q) ? q : 0;
}

/** A design+colour pair the lot runs — the unit managers plan and chase. */
export interface Sku {
  key: string;
  designId: number;
  designName: string;
  colorId: number;
  colorName: string;
  colorHex: string | null;
  planned: number;
}

export interface StageStat {
  stageId: number;
  name: string;
  index: number;
  total: number;
  entries: number;
  /** Quantity per SKU key at this stage. */
  bySku: Record<string, number>;
  /** Units that reached the previous stage but not this one. */
  lostFromPrev: number | null;
  lostPctFromPrev: number | null;
  isBottleneck: boolean;
}

export interface SkuProgress extends Sku {
  started: number;
  done: number;
  donePct: number | null;
  /** Percentage points above/below the lot's average completion. */
  vsAverage: number | null;
  status: "done" | "on_track" | "behind" | "stalled" | "not_started";
}

export interface DayPoint {
  /** ISO yyyy-mm-dd, used as the ordering key. */
  date: string;
  label: string;
  started: number;
  finished: number;
  /** Units in the line at end of day — the gap between the two curves. */
  wip: number;
}

export interface MachineStat {
  machineId: number;
  name: string;
  qty: number;
  entries: number;
  stageNames: string[];
}

export interface LotAnalytics {
  lotSize: number | null;
  plannedTotal: number;
  skus: Sku[];
  stages: StageStat[];
  first: StageStat | null;
  final: StageStat | null;
  bottleneck: StageStat | null;
  /** Reached the last stage. */
  completed: number;
  completionPct: number | null;
  /** The number completion is measured against. */
  target: number;
  /** Started but not yet finished — units sitting in the line. */
  wip: number;
  /** Share of started units that made it all the way through. */
  yieldPct: number | null;
  progress: SkuProgress[];
  timeline: DayPoint[];
  machines: MachineStat[];
  daysActive: number;
  dailyRate: number | null;
  daysRemaining: number | null;
  projectedFinish: Date | null;
  totalEntries: number;
}

const skuKey = (designId: number | null, colorId: number | null) =>
  `${designId ?? "x"}:${colorId ?? "x"}`;
/** yyyy-mm-dd, or null if the backend didn't send a usable timestamp. */
const dayKey = (iso: string | null | undefined) =>
  typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : null;

/**
 * Classify a SKU against the lot's own average pace. There are no per-SKU due
 * dates in the data, so "behind" means behind its siblings — the comparison a
 * supervisor can actually act on today.
 */
function classify(donePct: number | null, avgPct: number): SkuProgress["status"] {
  if (donePct == null || donePct <= 0) return "not_started";
  if (donePct >= 100) return "done";
  const gap = donePct - avgPct;
  if (gap <= -30) return "stalled";
  if (gap <= -10) return "behind";
  return "on_track";
}

export function analyseLot(
  batch: BatchRead,
  template: TemplateRead,
  machines: Machine[],
  /** Limit to one design; null/undefined means the whole lot. */
  designFilter?: number | null,
): LotAnalytics {
  const keep = (designId: number | null) => designFilter == null || designId === designFilter;

  const skus: Sku[] = batch.designs
    .filter((d) => keep(d.design_id))
    .flatMap((d) =>
      d.colors.map((c) => ({
        key: skuKey(d.design_id, c.color_id),
        designId: d.design_id,
        designName: d.name,
        colorId: c.color_id,
        colorName: c.name,
        colorHex: c.hex,
        planned: c.quantity ?? 0,
      })),
    );
  const plannedTotal = round2(skus.reduce((s, k) => s + k.planned, 0));
  const entries = batch.stage_entries.filter((e) => keep(e.design_id));

  // ---- per stage -------------------------------------------------------- //
  const raw = template.stages.map((stage) => {
    const mine = entries.filter((e) => e.stage_id === stage.id);
    const bySku: Record<string, number> = {};
    let total = 0;
    for (const e of mine) {
      const q = entryQuantity(stage, e);
      total += q;
      const k = skuKey(e.design_id, e.color_id);
      bySku[k] = (bySku[k] ?? 0) + q;
    }
    return { stage, mine, bySku, total: round2(total) };
  });

  // The bottleneck is the stage that swallowed the most units. A big absolute
  // drop matters more than a big percentage on a stage only three units reached.
  let worstIdx = -1;
  let worstLoss = 0;
  const stages: StageStat[] = raw.map((r, i) => {
    const prev = i > 0 ? raw[i - 1].total : null;
    const lost = prev != null ? round2(prev - r.total) : null;
    if (lost != null && lost > worstLoss) {
      worstLoss = lost;
      worstIdx = i;
    }
    return {
      stageId: r.stage.id,
      name: r.stage.name,
      index: r.stage.order_index,
      total: r.total,
      entries: r.mine.length,
      bySku: r.bySku,
      lostFromPrev: lost,
      lostPctFromPrev: lost != null && prev ? round2((lost / prev) * 100) : null,
      isBottleneck: false,
    };
  });
  if (worstIdx >= 0 && worstLoss > 0) stages[worstIdx].isBottleneck = true;

  const first = stages[0] ?? null;
  const final = stages[stages.length - 1] ?? null;
  const bottleneck = stages.find((s) => s.isBottleneck) ?? null;

  const completed = final?.total ?? 0;
  // Filtering to one design makes the lot size the wrong yardstick — that
  // design's own plan is.
  const target = designFilter == null ? batch.lot_size ?? plannedTotal : plannedTotal;
  const completionPct = target > 0 ? round2((completed / target) * 100) : null;
  const startedTotal = first?.total ?? 0;
  const wip = round2(Math.max(0, startedTotal - completed));
  const yieldPct = startedTotal > 0 ? round2((completed / startedTotal) * 100) : null;

  // ---- per SKU ---------------------------------------------------------- //
  const avgPct = plannedTotal > 0 ? (completed / plannedTotal) * 100 : 0;
  const progress: SkuProgress[] = skus.map((k) => {
    const startedQty = round2(first?.bySku[k.key] ?? 0);
    const doneQty = round2(final?.bySku[k.key] ?? 0);
    const donePct = k.planned > 0 ? round2((doneQty / k.planned) * 100) : null;
    return {
      ...k,
      started: startedQty,
      done: doneQty,
      donePct,
      vsAverage: donePct != null ? round2(donePct - avgPct) : null,
      status: classify(donePct, avgPct),
    };
  });

  // ---- flow over time --------------------------------------------------- //
  // Cumulative "started" vs "finished" per day. The vertical gap between the two
  // curves is work-in-progress, which is what makes a pile-up visible.
  const stageById = new Map(template.stages.map((s) => [s.id, s]));
  const perDay = new Map<string, { started: number; finished: number }>();
  const bump = (iso: string, field: "started" | "finished", q: number) => {
    const d = dayKey(iso);
    if (d === null) return; // undated entry — it just can't appear on the time axis
    const cur = perDay.get(d) ?? { started: 0, finished: 0 };
    cur[field] += q;
    perDay.set(d, cur);
  };
  for (const e of entries) {
    const st = stageById.get(e.stage_id);
    if (!st) continue;
    if (first && e.stage_id === first.stageId) bump(e.created_at, "started", entryQuantity(st, e));
    if (final && e.stage_id === final.stageId) bump(e.created_at, "finished", entryQuantity(st, e));
  }
  let cs = 0;
  let cf = 0;
  const timeline: DayPoint[] = [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      cs = round2(cs + v.started);
      cf = round2(cf + v.finished);
      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
        started: cs,
        finished: cf,
        wip: round2(Math.max(0, cs - cf)),
      };
    });

  // ---- machines --------------------------------------------------------- //
  const agg = new Map<number, { qty: number; entries: number; stages: Set<string> }>();
  for (const r of raw) {
    if (!r.stage.has_machines) continue;
    for (const e of r.mine) {
      for (const me of e.machine_entries) {
        const cur = agg.get(me.machine_id) ?? { qty: 0, entries: 0, stages: new Set<string>() };
        cur.qty += me.quantity ?? 0;
        cur.entries += 1;
        cur.stages.add(r.stage.name);
        agg.set(me.machine_id, cur);
      }
    }
  }
  const machineStats: MachineStat[] = [...agg.entries()]
    .map(([machineId, v]) => ({
      machineId,
      name: machines.find((m) => m.id === machineId)?.name ?? `#${machineId}`,
      qty: round2(v.qty),
      entries: v.entries,
      stageNames: [...v.stages],
    }))
    .sort((a, b) => b.qty - a.qty);

  // ---- pace ------------------------------------------------------------- //
  const daysActive = timeline.length;
  const dailyRate = daysActive > 0 && completed > 0 ? round2(completed / daysActive) : null;
  const remaining = target > 0 ? Math.max(0, round2(target - completed)) : 0;
  const daysRemaining = dailyRate && dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
  const projectedFinish =
    daysRemaining != null && remaining > 0
      ? new Date(Date.now() + daysRemaining * 86_400_000)
      : null;

  return {
    lotSize: batch.lot_size,
    plannedTotal,
    skus,
    stages,
    first,
    final,
    bottleneck,
    completed,
    completionPct,
    target,
    wip,
    yieldPct,
    progress,
    timeline,
    machines: machineStats,
    daysActive,
    dailyRate,
    daysRemaining,
    projectedFinish,
    totalEntries: entries.length,
  };
}
