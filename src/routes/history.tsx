import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OmDataList } from "@omarchy/ui/react";
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

        <Card>
          <CardContent className="overflow-x-auto p-5 text-sm">
            {/* Table markup, empty state and paging come from OmDataList; the
                row cells stay here. `key` sends a new filter back to page 1. */}
            <OmDataList
              key={q}
              className="logbook"
              items={filtered}
              density="table"
              perPage={25}
              showCount={false}
              emptyLabel="Nothing matches."
              rowKey={(w) => w.id}
              renderRow={(w) => <Row workout={w} />}
              head={
                <tr>
                  <th>Date</th>
                  <th>Work</th>
                  <th className="om-num">Meters</th>
                  <th className="om-num">Time</th>
                  <th className="om-num">/500m</th>
                  <th className="om-num">SPM</th>
                  <th className="om-num">W</th>
                  <th className="om-num">HR</th>
                  <th className="om-num">Share</th>
                </tr>
              }
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

/** The <td>s only — OmDataList wraps them in its own <tr>. */
function Row({ workout }: { workout: Workout }) {
  const split = inferredSplit(workout);
  return (
    <>
      <td className="text-muted">{formatDate(workout.sessionDate)}</td>
      <td>
        <Link
          to="/session/$slug"
          params={{ slug: workout.slug }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {workout.description}
        </Link>
        {workout.notes ? <div className="text-xs text-muted">{workout.notes}</div> : null}
      </td>
      <td className="om-num">{formatMetersFull(workout.distanceM)}</td>
      <td className="om-num">{formatWorkTime(workout.workSeconds)}</td>
      <td className="om-num">{formatSplit(split)}</td>
      <td className="om-num">{workout.strokeRate ?? "—"}</td>
      <td className="om-num">{workout.watts ?? "—"}</td>
      <td className="om-num">{workout.avgHr ?? "—"}</td>
      <td className="om-num !py-1">
        <ShareButton payload={shareWorkoutPayload(workout)} label="Share session" iconOnly variant="ghost" />
      </td>
    </>
  );
}
