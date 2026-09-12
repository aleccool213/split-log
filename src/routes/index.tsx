import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Timer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DistanceChart, SplitTrendChart, WeeklyVolumeChart } from "@/components/charts";
import { MeterHeatmap } from "@/components/heatmap";
import { SessionRow } from "@/components/session-row";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateLong,
  formatMetersFull,
  formatSplit,
  formatWorkTime,
} from "@/lib/format";
import { shareWorkoutPayload } from "@/lib/share";
import { getDashboard } from "@/lib/workouts.functions";
import { inferredSplit } from "@/lib/workouts";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: Home,
});

function Home() {
  const { workouts, stats } = Route.useLoaderData();
  const last = stats.lastWorkout;
  const weekDelta = stats.weekMeters - stats.lastWeekMeters;
  const recent = workouts.slice(0, 6);

  return (
    <AppShell>
      <div className="stagger-in flex flex-col gap-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Concept 2 log</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Alec Brunelle’s rowing tracker
            </h1>
            <p className="mt-2 max-w-xl text-muted">
              Public training board for the Concept 2. Meters, splits, and how the season is bending.
            </p>
          </div>
          {stats.due ? (
            <Badge variant="warn" className="h-8 px-3 text-sm">
              {stats.daysSince == null
                ? "First session is waiting"
                : `${stats.daysSince} day${stats.daysSince === 1 ? "" : "s"} off the water`}
            </Badge>
          ) : (
            <Badge variant="outline" className="h-8 px-3 text-sm">
              Last row {stats.daysSince === 0 ? "today" : `${stats.daysSince}d ago`}
            </Badge>
          )}
        </section>

        {stats.due && (
          <div className="rounded-xl bg-warn-bg px-5 py-4 text-warn">
            <p className="text-sm font-medium">
              The tank does not row itself. Twenty minutes of steady state still counts. Add a row to
              the log file and push.
            </p>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="This week"
            value={formatMetersFull(stats.weekMeters)}
            hint={
              <span className="inline-flex items-center gap-1">
                {weekDelta >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {formatMetersFull(Math.abs(weekDelta))} vs last week
              </span>
            }
          />
          <Stat
            label="7-day split"
            value={formatSplit(stats.avgSplit7)}
            hint="/500m average"
          />
          <Stat
            label="Season meters"
            value={formatMetersFull(stats.totalMeters)}
            hint={`${stats.totalSessions} sessions`}
          />
          <Stat
            label="Week streak"
            value={String(stats.streakWeeks)}
            hint="weeks with 2+ sessions"
          />
        </section>

        {last && (
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardDescription>Last session</CardDescription>
                <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>{last.description}</span>
                  <span className="font-sans text-base font-medium text-muted">
                    {formatDateLong(last.sessionDate)}
                  </span>
                </CardTitle>
              </div>
              <ShareButton payload={shareWorkoutPayload(last)} label="Share" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Distance" value={formatMetersFull(last.distanceM)} />
              <Mini label="Time" value={formatWorkTime(last.workSeconds)} />
              <Mini label="Split" value={formatSplit(inferredSplit(last))} />
              <Mini
                label="Watts / HR"
                value={`${last.watts ?? "—"} W · ${last.avgHr ?? "—"}`}
              />
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weekly volume</CardTitle>
              <CardDescription>Kilometers on the erg, Monday weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyVolumeChart weekly={stats.weekly} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Split trend</CardTitle>
              <CardDescription>Average /500m on pieces 2k and up — lower is faster</CardDescription>
            </CardHeader>
            <CardContent>
              <SplitTrendChart workouts={workouts} />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Distance per session</CardTitle>
            <CardDescription>Raw meters, every logged row</CardDescription>
          </CardHeader>
          <CardContent>
            <DistanceChart workouts={workouts} />
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Season grid</CardTitle>
              <CardDescription>Sixteen weeks of meters. Darker is more work.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeterHeatmap workouts={workouts} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Personal bests</CardTitle>
              <CardDescription>Fastest work time at a standard distance</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {stats.pbs.map((pb) => (
                <div key={pb.label} className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{pb.label}</p>
                    <p className="font-display text-2xl font-semibold tabular">
                      {pb.workout ? formatWorkTime(pb.workout.workSeconds) : "—"}
                    </p>
                  </div>
                  <p className="text-sm text-muted tabular">
                    {pb.workout ? formatSplit(inferredSplit(pb.workout)) : "not yet"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent sessions</CardTitle>
              <CardDescription>Newest first</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/history">Full logbook</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyLog />
            ) : (
              recent.map((w) => <SessionRow key={w.id} workout={w} />)
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="font-display text-3xl font-semibold tabular tracking-tight">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium tabular">{value}</p>
    </div>
  );
}

function EmptyLog() {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <Timer className="size-6 text-muted" />
      <p className="text-sm text-muted">No sessions yet. Add a row to data/split-log.csv and push.</p>
    </div>
  );
}
