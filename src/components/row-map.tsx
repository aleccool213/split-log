import { useRef, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCourseLoop } from "@/components/course-loop";
import {
  BUOY_EVERY_M,
  COURSE_METERS,
  COURSE_PATH,
  distanceAt,
  lapOf,
  LANDMARKS,
  lastLandmark,
  newLandmarks,
  nextLandmark,
  pathBetween,
  pointAtDistance,
  VIEW,
  type Leg,
  type Pose,
} from "@/lib/course";
import { formatMetersFull } from "@/lib/format";
import type { Segment } from "@/lib/insights";

/** Where each landmark's name sits relative to its marker, tuned to the drawn course. */
const LABELS: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  "Willow Bend": { dx: 9, dy: 4, anchor: "start" },
  "The Narrows": { dx: -6, dy: -9, anchor: "end" },
  "Stone Bridge": { dx: 9, dy: -5, anchor: "start" },
  Boathouse: { dx: 9, dy: -7, anchor: "start" },
  "Heron Point": { dx: -9, dy: 4, anchor: "end" },
  "Harbour Light": { dx: 8, dy: 22, anchor: "end" },
};

/** Sideways offset, in SVG units, that puts the ghost in the next lane. */
const LANE = 5;

type Props = {
  distanceM: number;
  workSeconds: number;
  segments: Segment[] | null;
  /** Baseline pace; null hides the ghost. */
  usualSplit: number | null;
  furthestBefore: number;
};

/** Legs for this row, scaled so the boat finishes on the logged distance. */
function rowLegs(distanceM: number, workSeconds: number, segments: Segment[] | null): Leg[] {
  if (!segments) return [{ seconds: workSeconds, meters: distanceM }];
  const total = segments.reduce((sum, s) => sum + s.meters, 0);
  return segments.map((s) => ({ seconds: s.seconds, meters: (s.meters * distanceM) / total }));
}

export function RowMap({ distanceM, workSeconds, segments, usualSplit, furthestBefore }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useCourseLoop(ref);

  const legs = rowLegs(distanceM, workSeconds, segments);
  const ghostMeters = usualSplit ? (workSeconds / usualSplit) * 500 : null;
  const t = frame.progress * workSeconds;
  const you = distanceAt(legs, t);
  const ghost =
    ghostMeters == null ? null : distanceAt([{ seconds: workSeconds, meters: ghostMeters }], t);
  const gap = ghostMeters == null ? null : Math.round(distanceM - ghostMeters);

  const fading = frame.phase === "fade" ? 1 - frame.phaseProgress : 1;
  const bob = frame.playing ? Math.sin(frame.clock / 320) * 0.6 : 0;
  const oar = frame.playing && frame.phase === "rowing" ? Math.sin(frame.clock / 70) * 28 : 0;

  const { lap } = lapOf(distanceM);
  const past = lastLandmark(distanceM);
  const next = nextLandmark(distanceM);
  const fresh = newLandmarks(distanceM, furthestBefore);
  const caption = [
    formatMetersFull(distanceM),
    past ? `past ${past.name}` : "short of the first landmark",
    next
      ? `${formatMetersFull(next.meters - lapOf(distanceM).meters)} to ${next.name}`
      : "at the harbour",
    gap == null
      ? null
      : gap === 0
        ? "level with usual you"
        : `${formatMetersFull(Math.abs(gap))} ${gap > 0 ? "ahead of" : "behind"} usual you`,
  ]
    .filter(Boolean)
    .join(" · ");

  const youPose = pointAtDistance(you);
  const ghostPose = ghost == null ? null : lane(pointAtDistance(ghost), LANE);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>On the water</CardTitle>
          <CardDescription>
            A mock 10 km course. A kilometre is always the same size.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {lap > 0 && <Chip>Lap {lap + 1}</Chip>}
          {fresh.length > 0 && <Chip strong>New water!</Chip>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div ref={ref}>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className="mx-auto block h-auto w-full max-w-2xl"
            role="img"
            aria-label={caption}
          >
            {/* Harbour basin and river */}
            <ellipse cx={370} cy={46} rx={24} ry={18} fill="var(--om-accent-soft)" />
            <path
              d={COURSE_PATH}
              fill="none"
              stroke="var(--om-accent-soft)"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={COURSE_PATH}
              fill="none"
              stroke="var(--om-line)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />

            {/* Earlier laps, faint, when the row went round more than once */}
            {lap > 0 && (
              <path
                d={COURSE_PATH}
                fill="none"
                stroke="var(--om-accent)"
                strokeOpacity={0.3 * fading}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}

            <Wake you={you} legs={legs} lapped={lap > 0} opacity={fading} />

            {/* Buoys every 500 m; they light up once passed */}
            {buoys().map((m) => {
              const p = pointAtDistance(m);
              const passed = you >= m;
              return (
                <circle
                  key={m}
                  cx={p.x}
                  cy={p.y}
                  r={1.8}
                  fill={passed ? "var(--om-accent)" : "var(--om-fg-subtle)"}
                  opacity={passed ? 1 : 0.5}
                />
              );
            })}

            {LANDMARKS.map((l) => {
              const p = pointAtDistance(l.meters);
              const label = LABELS[l.name];
              const reached = distanceM >= l.meters;
              return (
                <g key={l.name}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={3.2}
                    fill="var(--om-surface)"
                    stroke={reached ? "var(--om-fg)" : "var(--om-fg-subtle)"}
                    strokeWidth={1.4}
                  />
                  <text
                    x={p.x + label.dx}
                    y={p.y + label.dy}
                    textAnchor={label.anchor}
                    fontSize={10.5}
                    fill={reached ? "var(--om-fg)" : "var(--om-fg-muted)"}
                    fontWeight={fresh.includes(l) ? 700 : 400}
                  >
                    {l.name}
                  </text>
                </g>
              );
            })}
            <text x={14} y={234} fontSize={10.5} fill="var(--om-fg-muted)">
              Start
            </text>

            {ghostPose && (
              <g opacity={fading}>
                <Boat pose={ghostPose} bob={-bob} oar={oar} ghost />
              </g>
            )}
            <g opacity={fading}>
              <Boat pose={youPose} bob={bob} oar={oar} />
            </g>

            {frame.phase !== "rowing" && frame.playing && (
              <circle
                cx={youPose.x}
                cy={youPose.y}
                r={5 + frame.phaseProgress * 14}
                fill="none"
                stroke="var(--om-accent)"
                strokeWidth={1.2}
                opacity={(1 - frame.phaseProgress) * fading}
              />
            )}
            {frame.phase !== "rowing" && gap != null && (
              <MarginTag pose={youPose} gap={gap} opacity={fading} />
            )}
          </svg>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <p>{caption}.</p>
          {fresh.length > 0 && (
            <p className="text-muted">
              First row to reach {fresh.map((l) => l.name).join(" and ")}.
              {next ? ` ${next.name} is next.` : ""}
            </p>
          )}
          {ghostPose && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <svg viewBox="-9 -5 20 10" className="h-3 w-6" aria-hidden>
                <Hull ghost />
              </svg>
              Usual you: your median pace for rows like this, in the next lane
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function buoys(): number[] {
  const landmarks = new Set(LANDMARKS.map((l) => l.meters));
  const out: number[] = [];
  for (let m = BUOY_EVERY_M; m < COURSE_METERS; m += BUOY_EVERY_M) {
    if (!landmarks.has(m)) out.push(m);
  }
  return out;
}

/** Shift a pose sideways (to port) by `by` units. */
function lane(p: Pose, by: number): Pose {
  const rad = (p.angle * Math.PI) / 180;
  return { ...p, x: p.x + Math.sin(rad) * by, y: p.y - Math.cos(rad) * by };
}

/**
 * The wake behind the boat. With splits, each segment is shaded by whether it
 * was quicker than the row's own average, matching the pacing bars.
 */
function Wake({
  you,
  legs,
  lapped,
  opacity,
}: {
  you: number;
  legs: Leg[];
  lapped: boolean;
  opacity: number;
}) {
  const into = lapOf(you).meters;
  if (lapped || legs.length < 2) {
    return (
      <path
        d={pathBetween(0, into)}
        fill="none"
        stroke="var(--om-accent)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  }
  const totalM = legs.reduce((s, l) => s + l.meters, 0);
  const totalS = legs.reduce((s, l) => s + l.seconds, 0);
  const avg = totalS / totalM;
  let start = 0;
  return (
    <g opacity={opacity}>
      {legs.map((leg, i) => {
        const from = start;
        start += leg.meters;
        if (from >= you) return null;
        const faster = leg.seconds / leg.meters <= avg;
        return (
          <path
            key={i}
            d={pathBetween(from, Math.min(start, you))}
            fill="none"
            stroke={faster ? "var(--om-accent)" : "var(--om-fg-subtle)"}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

function Hull({ ghost = false }: { ghost?: boolean }) {
  return (
    <path
      d="M-8 0 Q-6 -2.8 0 -2.8 Q6 -2.6 10 0 Q6 2.6 0 2.8 Q-6 2.8 -8 0 Z"
      fill={ghost ? "var(--om-surface)" : "var(--om-accent)"}
      stroke={ghost ? "var(--om-fg-muted)" : "var(--om-surface)"}
      strokeWidth={ghost ? 1 : 0.8}
      strokeDasharray={ghost ? "2 1.5" : undefined}
    />
  );
}

function Boat({
  pose,
  bob,
  oar,
  ghost = false,
}: {
  pose: Pose;
  bob: number;
  oar: number;
  ghost?: boolean;
}) {
  const stroke = ghost ? "var(--om-fg-muted)" : "var(--om-fg)";
  return (
    <g
      transform={`translate(${pose.x.toFixed(2)} ${(pose.y + bob).toFixed(2)}) rotate(${pose.angle.toFixed(1)}) scale(1.3)`}
    >
      <g transform={`rotate(${oar.toFixed(1)})`}>
        <line
          x1={0}
          y1={-2}
          x2={-2}
          y2={-10}
          stroke={stroke}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
      <g transform={`rotate(${(-oar).toFixed(1)})`}>
        <line x1={0} y1={2} x2={-2} y2={10} stroke={stroke} strokeWidth={1} strokeLinecap="round" />
      </g>
      <Hull ghost={ghost} />
    </g>
  );
}

function MarginTag({ pose, gap, opacity }: { pose: Pose; gap: number; opacity: number }) {
  const text =
    gap === 0 ? "level" : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toLocaleString("en-CA")} m`;
  const w = text.length * 6.4 + 10;
  const x = Math.min(VIEW.width - w - 2, Math.max(2, pose.x - w / 2));
  const y = pose.y - 26 < 4 ? pose.y + 12 : pose.y - 26;
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={15} rx={3} fill="var(--om-fg)" />
      <text
        x={x + w / 2}
        y={y + 11}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill="var(--om-bg)"
      >
        {text}
      </text>
    </g>
  );
}

function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        strong
          ? "bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg"
          : "border border-border px-2 py-0.5 text-xs text-muted"
      }
    >
      {children}
    </span>
  );
}
