import { useMemo } from "react";
import { OmTimeSeriesChart, type ChartSeries } from "@omarchy/ui/react";
import { formatDate, formatMetersFull, formatSplit } from "@/lib/format";
import type { WeeklyPoint, Workout } from "@/lib/workouts";
import { inferredSplit } from "@/lib/workouts";

// The drawing, axes, crosshair and table view come from OmTimeSeriesChart;
// these only turn workouts into series and say how a point should read.

function weekLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function byDate(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

export function WeeklyVolumeChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: "volume",
        label: "Volume",
        points: weekly.map((w) => ({
          label: weekLabel(w.weekStart),
          value: w.meters,
          tip: `${formatMetersFull(w.meters)} · ${w.sessions} session${w.sessions === 1 ? "" : "s"}`,
        })),
      },
    ],
    [weekly],
  );
  return (
    <OmTimeSeriesChart
      title="Weekly volume"
      unit="meters, Monday weeks"
      kind="bar"
      format="k"
      series={series}
    />
  );
}

export function SplitTrendChart({ workouts }: { workouts: Workout[] }) {
  const series = useMemo<ChartSeries[]>(() => {
    const points = byDate(workouts)
      .filter((w) => w.distanceM >= 2000)
      .map((w) => ({ w, split: inferredSplit(w) }))
      .filter((d): d is { w: Workout; split: number } => d.split != null)
      .map(({ w, split }) => ({
        label: w.sessionDate.slice(5),
        value: Math.round(split * 10) / 10,
        tip: `${formatSplit(split)} /500m · ${w.description}`,
      }));
    return [{ key: "split", label: "Split", points }];
  }, [workouts]);
  return (
    <OmTimeSeriesChart
      title="Split trend"
      unit="/500m, pieces 2k and up"
      note="Lower is faster, so the axis runs fast at the top."
      kind="line"
      format="clock"
      reverseY
      markers
      series={series}
    />
  );
}

export function DistanceChart({ workouts }: { workouts: Workout[] }) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: "distance",
        label: "Distance",
        points: byDate(workouts).map((w) => ({
          label: w.sessionDate.slice(5),
          value: w.distanceM,
          tip: `${formatMetersFull(w.distanceM)} · ${formatDate(w.sessionDate)}`,
        })),
      },
    ],
    [workouts],
  );
  return (
    <OmTimeSeriesChart
      title="Distance per session"
      unit="meters, every logged row"
      kind="area"
      format="k"
      // This chart spans the full board, so a wider viewBox keeps its axis
      // text the same size as the half-width charts beside it.
      width={1040}
      height={240}
      series={series}
    />
  );
}
