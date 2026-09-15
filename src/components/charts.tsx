import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMeters, formatSplit } from "@/lib/format";
import type { WeeklyPoint, Workout } from "@/lib/workouts";
import { inferredSplit } from "@/lib/workouts";

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 0,
  fontSize: 12,
  color: "var(--color-fg)",
  boxShadow: "none",
};

function weekLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function WeeklyVolumeChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const data = weekly.map((w) => ({
    ...w,
    label: weekLabel(w.weekStart),
    km: Math.round((w.meters / 1000) * 10) / 10,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 6" />
        <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} km`, "Volume"]}
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as WeeklyPoint | undefined;
            return p ? `${p.sessions} session${p.sessions === 1 ? "" : "s"}` : "";
          }}
        />
        <Bar dataKey="km" fill="var(--color-primary)" radius={[0, 0, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SplitTrendChart({ workouts }: { workouts: Workout[] }) {
  const data = [...workouts]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .filter((w) => w.distanceM >= 2000)
    .map((w) => {
      const split = inferredSplit(w);
      return {
        date: w.sessionDate.slice(5),
        split: split ? Math.round(split * 10) / 10 : null,
        label: w.description,
      };
    })
    .filter((d) => d.split != null);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 6" />
        <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          reversed
          domain={["dataMin - 2", "dataMax + 2"]}
          tickFormatter={(v) => formatSplit(Number(v))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatSplit(Number(value)), "/500m"]}
        />
        <Line
          type="monotone"
          dataKey="split"
          stroke="var(--color-fg)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary)", stroke: "var(--color-bg-elevated)", strokeWidth: 1 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistanceChart({ workouts }: { workouts: Workout[] }) {
  const data = [...workouts]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .map((w) => ({
      date: w.sessionDate.slice(5),
      meters: w.distanceM,
    }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 6" />
        <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatMeters(Number(value)), "Distance"]}
        />
        <Area
          type="monotone"
          dataKey="meters"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="var(--color-primary)"
          fillOpacity={0.12}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
