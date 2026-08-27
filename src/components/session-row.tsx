import { formatDate, formatMetersFull, formatSplit, formatWorkTime } from "@/lib/format";
import type { Workout } from "@/lib/workouts";
import { inferredSplit } from "@/lib/workouts";

export function SessionRow({ workout }: { workout: Workout }) {
  const split = inferredSplit(workout);
  return (
    <article className="flex items-baseline justify-between gap-4 border-b border-border/80 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{workout.description}</p>
        <p className="text-xs text-muted">
          {formatDate(workout.sessionDate)}
          {workout.notes ? ` · ${workout.notes}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right tabular">
        <p className="font-medium">{formatMetersFull(workout.distanceM)}</p>
        <p className="text-xs text-muted">
          {formatWorkTime(workout.workSeconds)}
          {split ? ` · ${formatSplit(split)}` : ""}
        </p>
      </div>
    </article>
  );
}
