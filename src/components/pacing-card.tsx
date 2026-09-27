import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSplit, formatWorkTime } from "@/lib/format";
import type { Evenness, Pacing, Segment } from "@/lib/insights";
import { cn } from "@/lib/utils";

const EVENNESS: Record<Evenness, string> = {
  even: "Even pacing",
  steady: "Steady pacing",
  uneven: "Uneven pacing",
};

/** Half the plot height, in px: the bar for the biggest swing reaches this far. */
const HALF = 56;

function fadeLine(fade: number): string {
  const pct = Math.abs(fade) * 100;
  if (pct < 0.5) return "Dead even: you finished at your opening pace.";
  if (fade < 0) return `Negative split: you finished ${pct.toFixed(1)}% faster than you started.`;
  return `You held ${(100 / (1 + fade)).toFixed(1)}% of your opening pace.`;
}

function span(seg: Segment): string {
  const end = seg.startSeconds + seg.seconds;
  const fmt = (s: number) =>
    s % 60 === 0 ? String(s / 60) : formatWorkTime(s).replace(/\.0$/, "");
  return `${fmt(seg.startSeconds)}–${fmt(end)}${end % 60 === 0 ? " min" : ""}`;
}

/**
 * Each segment's pace as a bar above (faster) or below (slower) the row's own
 * average. Direction carries the meaning, so the two tones are a second cue,
 * not the only one.
 */
export function PacingCard({
  segments,
  pacing,
  usualSplit,
}: {
  segments: Segment[];
  pacing: Pacing;
  usualSplit: number | null;
}) {
  // Positive = faster than this row's average.
  const deltas = segments.map((s) => pacing.split - s.split);
  const usual = usualSplit == null ? null : pacing.split - usualSplit;
  const reach = Math.max(1, ...deltas.map(Math.abs), usual == null ? 0 : Math.abs(usual));
  const px = (d: number) => (Math.abs(d) / reach) * HALF;
  const segMinutes = Math.round(segments[0].seconds / 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pacing</CardTitle>
        <CardDescription>
          {segMinutes}-min splits from your notes, against this row’s average of{" "}
          {formatSplit(pacing.split)} /500m
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <p>{fadeLine(pacing.fade)}</p>
          <p className="text-muted">
            {EVENNESS[pacing.evenness]} · {(pacing.cv * 100).toFixed(1)}% spread between segments
          </p>
        </div>

        <figure className="flex flex-col gap-2">
          <div className="relative" style={{ height: HALF * 2 }}>
            {/* This row's average: the zero line the bars grow from. */}
            <div
              className="absolute inset-x-0 border-t border-border"
              style={{ top: HALF }}
              aria-hidden
            />
            {usual != null && (
              <div
                className="absolute inset-x-0 flex justify-end border-t border-dashed border-muted"
                style={{ top: HALF - Math.sign(usual) * px(usual) }}
                aria-hidden
              >
                <span className="-translate-y-full bg-card px-1 text-[11px] leading-4 text-muted">
                  usual {formatSplit(usualSplit)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 flex gap-2 px-1">
              {segments.map((seg, i) => {
                const d = deltas[i];
                const faster = d >= 0;
                const h = Math.max(2, px(d));
                return (
                  <div
                    key={seg.startSeconds}
                    className="relative flex-1"
                    title={`${span(seg)}: ${seg.meters} m at ${formatSplit(seg.split)} /500m`}
                  >
                    <div
                      className={cn(
                        "absolute inset-x-[18%] sm:inset-x-[28%]",
                        faster ? "rounded-t-[4px] bg-primary" : "rounded-b-[4px] bg-subtle",
                      )}
                      style={faster ? { bottom: HALF, height: h } : { top: HALF, height: h }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <ol className="flex gap-2 px-1 text-center">
            {segments.map((seg, i) => (
              <li key={seg.startSeconds} className="flex-1">
                <p className="text-sm font-medium tabular">{formatSplit(seg.split)}</p>
                <p className="text-xs text-muted tabular">
                  {seg.meters} m{deltas[i] >= 0 ? " ▲" : " ▼"}
                </p>
                <p className="text-[11px] text-subtle tabular">{span(seg)}</p>
              </li>
            ))}
          </ol>
          <figcaption className="sr-only">
            {segments
              .map((s) => `${span(s)}: ${s.meters} m at ${formatSplit(s.split)} per 500 m.`)
              .join(" ")}
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}
