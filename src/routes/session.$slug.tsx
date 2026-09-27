import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OmStat, OmStatGrid } from "@omarchy/ui/react";
import { AppShell } from "@/components/app-shell";
import { PacingCard } from "@/components/pacing-card";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatDateLong,
  formatMetersFull,
  formatSplit,
  formatWorkTime,
} from "@/lib/format";
import { metersPerStroke, type SessionInsights, type VerdictTone } from "@/lib/insights";
import { shareWorkoutPayload } from "@/lib/share";
import { getWorkout } from "@/lib/workouts.functions";
import { inferredSplit, inferredWatts, type Workout } from "@/lib/workouts";

export const Route = createFileRoute("/session/$slug")({
  loader: ({ params }) => getWorkout({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.workout.description} · ${formatDate(loaderData.workout.sessionDate)} — Split Log`,
          },
        ]
      : [],
  }),
  component: SessionPage,
  notFoundComponent: MissingSession,
});

const BADGE: Record<VerdictTone, "primary" | "outline" | "warn"> = {
  better: "primary",
  normal: "outline",
  building: "warn",
};

function SessionPage() {
  const { workout, insights, prevSlug, nextSlug } = Route.useLoaderData();
  const { baseline: base, verdict } = insights;
  const split = inferredSplit(workout);
  const watts = inferredWatts(workout);
  const mps = metersPerStroke(workout);

  return (
    <AppShell>
      <div className="stagger-in flex flex-col gap-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.18em] text-muted hover:text-fg"
            >
              <ChevronLeft className="size-3.5" /> Logbook
            </Link>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {workout.description}
            </h1>
            <p className="mt-2 text-muted">
              {formatDateLong(workout.sessionDate)} · {formatWorkTime(workout.workSeconds)}
              {workout.strokeRate ? ` · ${workout.strokeRate} spm` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {verdict && (
              <Badge variant={BADGE[verdict.tone]} className="h-8 px-3 text-sm">
                {verdict.isPb ? "New best" : verdict.label}
              </Badge>
            )}
            <ShareButton payload={shareWorkoutPayload(workout)} label="Share" />
          </div>
        </section>

        <VerdictCard workout={workout} insights={insights} />

        <OmStatGrid cols={2} colsSm={4}>
          <OmStat
            label="Split"
            value={formatSplit(split)}
            unit="/500m"
            delta={verdict ? round1(verdict.deltaSplit) : null}
            goodDirection="down"
          >
            {base && <StatNote>usual {formatSplit(base.split)}</StatNote>}
          </OmStat>
          <OmStat
            label="Meters"
            value={workout.distanceM}
            format="locale"
            unit="m"
            delta={insights.ghostGap == null ? null : Math.round(insights.ghostGap)}
            deltaFormat="locale"
          >
            {insights.ghostGap != null && <StatNote>vs usual pace, same time</StatNote>}
          </OmStat>
          <OmStat
            label="Watts"
            value={watts}
            unit="W"
            delta={base?.watts != null && watts != null ? watts - base.watts : null}
            deltaFormat="int"
          >
            {base?.watts != null && <StatNote>usual {Math.round(base.watts)} W</StatNote>}
          </OmStat>
          <OmStat
            label="Per stroke"
            value={mps == null ? null : mps.toFixed(1)}
            unit="m"
            delta={
              mps != null && base?.metersPerStroke != null
                ? round1(mps - base.metersPerStroke)
                : null
            }
          >
            {base?.metersPerStroke != null ? (
              <StatNote>usual {base.metersPerStroke.toFixed(1)} m</StatNote>
            ) : (
              <StatNote>distance per stroke</StatNote>
            )}
          </OmStat>
        </OmStatGrid>

        {insights.segments && insights.pacing && (
          <PacingCard
            segments={insights.segments}
            pacing={insights.pacing}
            usualSplit={base?.split ?? null}
          />
        )}

        <section className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {insights.next && <NextTimeCard workout={workout} next={insights.next} />}
          <ComparedCard workout={workout} insights={insights} />
        </section>

        {workout.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">{workout.notes}</p>
            </CardContent>
          </Card>
        )}

        <nav className="flex items-center justify-between gap-3" aria-label="Other sessions">
          {prevSlug ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/session/$slug" params={{ slug: prevSlug }}>
                <ChevronLeft className="size-4" /> Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {nextSlug && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/session/$slug" params={{ slug: nextSlug }}>
                Next <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </AppShell>
  );
}

/** "~20 min rows" or "2,000m test rows" — what this row was compared with. */
function basisLabel(workout: Workout, insights: SessionInsights): string {
  if (insights.basis === "name") return `${workout.description} rows`;
  return `~${Math.round(workout.workSeconds / 60)} min rows`;
}

function VerdictCard({ workout, insights }: { workout: Workout; insights: SessionInsights }) {
  const { verdict } = insights;
  const kind = basisLabel(workout, insights);

  if (!verdict) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>How it compares</CardDescription>
          <CardTitle>Not enough history yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Log {insights.needed} more {kind.replace(/ rows$/, "")} row
            {insights.needed === 1 ? "" : "s"} to unlock the comparison with your usual.
          </p>
        </CardContent>
      </Card>
    );
  }

  const secs = Math.abs(verdict.deltaSplit).toFixed(1);
  const pace =
    verdict.tone === "normal"
      ? `Within ${secs} s/500m of your usual ${kind.replace(/ rows$/, " row")}.`
      : `${secs} s/500m ${verdict.deltaSplit < 0 ? "faster" : "slower"} than your usual ${kind.replace(/ rows$/, " row")}.`;
  const rank = verdict.isPb
    ? `Fastest of ${verdict.of} — a new best.`
    : `${ordinal(verdict.rank)} fastest of ${verdict.of}.`;
  const gap = Math.round(insights.ghostGap ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardDescription>How it compares</CardDescription>
        <CardTitle>{verdict.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm">
          {pace} {rank}
        </p>
        <p className="text-sm text-muted">
          {gap === 0
            ? "You finished dead level with your usual self."
            : `You finished ${formatMetersFull(Math.abs(gap))} ${gap > 0 ? "ahead of" : "behind"} your usual self.`}
        </p>
      </CardContent>
    </Card>
  );
}

function NextTimeCard({
  workout,
  next,
}: {
  workout: Workout;
  next: NonNullable<SessionInsights["next"]>;
}) {
  const best = next.best;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Next time</CardDescription>
        <CardTitle className="tabular">{formatSplit(next.split)} /500m</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          Hold that for {formatWorkTime(workout.workSeconds)} and you’d row{" "}
          <span className="font-medium tabular">~{formatMetersFull(next.meters)}</span>
          {next.beatBy > 0 ? `, ${formatMetersFull(next.beatBy)} more than today.` : "."}
        </p>
        {best && best.slug !== workout.slug && (
          <p className="text-muted">
            Your best for this length is{" "}
            <Link
              to="/session/$slug"
              params={{ slug: best.slug }}
              className="underline underline-offset-2"
            >
              {formatSplit(best.split)} ({formatDate(best.sessionDate)})
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ComparedCard({ workout, insights }: { workout: Workout; insights: SessionInsights }) {
  const rows = [...insights.comparables, workout];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compared with</CardTitle>
        <CardDescription>
          {insights.comparables.length === 0
            ? "No earlier rows like this one yet"
            : `Earlier ${basisLabel(workout, insights)}, oldest first`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {rows.map((w) => {
            const current = w.slug === workout.slug;
            return (
              <li key={w.slug} className="flex items-center justify-between gap-3 py-2">
                {current ? (
                  <span className="font-medium">{formatDate(w.sessionDate)} ·&nbsp;this</span>
                ) : (
                  <Link
                    to="/session/$slug"
                    params={{ slug: w.slug }}
                    className="text-muted hover:text-fg"
                  >
                    {formatDate(w.sessionDate)}
                  </Link>
                )}
                <span
                  className={`shrink-0 whitespace-nowrap tabular ${current ? "font-medium" : "text-muted"}`}
                >
                  {formatMetersFull(w.distanceM)} · {formatSplit(inferredSplit(w))}
                </span>
              </li>
            );
          })}
        </ul>
        {insights.baseline && (
          <p className="mt-3 text-xs text-muted">
            Usual = the median: {formatSplit(insights.baseline.split)} /500m.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MissingSession() {
  return (
    <AppShell>
      <div className="flex flex-col items-start gap-3 py-10">
        <h1 className="font-display text-3xl font-semibold">No session on that date</h1>
        <p className="text-muted">It may have been moved or removed from the log.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/history">Open the logbook</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function StatNote({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}
