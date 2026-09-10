import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ShareButton } from "@/components/share-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDate,
  formatMetersFull,
  formatSplit,
  formatWorkTime,
} from "@/lib/format";
import { shareWorkoutPayload } from "@/lib/share";
import { getDashboard } from "@/lib/workouts.functions";
import { inferredSplit, type Workout } from "@/lib/workouts";

export const Route = createFileRoute("/history")({
  loader: () => getDashboard(),
  component: HistoryPage,
});

function HistoryPage() {
  const { workouts } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workouts;
    return workouts.filter((w) =>
      `${w.description} ${w.notes} ${w.sessionDate}`.toLowerCase().includes(needle),
    );
  }, [q, workouts]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Logbook</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Every session</h1>
            <p className="mt-2 text-muted">{workouts.length} rows on the board.</p>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter description or notes"
            className="sm:max-w-xs"
          />
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-surface/60 text-xs uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <Th>Date</Th>
                    <Th>Work</Th>
                    <Th className="text-right">Meters</Th>
                    <Th className="text-right">Time</Th>
                    <Th className="text-right">/500m</Th>
                    <Th className="text-right">SPM</Th>
                    <Th className="text-right">W</Th>
                    <Th className="text-right">HR</Th>
                    <Th className="text-right">Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => (
                    <Row key={w.id} workout={w} />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-muted">
                        Nothing matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

function Row({ workout }: { workout: Workout }) {
  const split = inferredSplit(workout);
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3 text-muted">{formatDate(workout.sessionDate)}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{workout.description}</div>
        {workout.notes ? <div className="text-xs text-muted">{workout.notes}</div> : null}
      </td>
      <td className="px-4 py-3 text-right tabular">{formatMetersFull(workout.distanceM)}</td>
      <td className="px-4 py-3 text-right tabular">{formatWorkTime(workout.workSeconds)}</td>
      <td className="px-4 py-3 text-right tabular">{formatSplit(split)}</td>
      <td className="px-4 py-3 text-right tabular">{workout.strokeRate ?? "—"}</td>
      <td className="px-4 py-3 text-right tabular">{workout.watts ?? "—"}</td>
      <td className="px-4 py-3 text-right tabular">{workout.avgHr ?? "—"}</td>
      <td className="px-2 py-2 text-right">
        <ShareButton payload={shareWorkoutPayload(workout)} label="Share session" iconOnly variant="ghost" />
      </td>
    </tr>
  );
}
