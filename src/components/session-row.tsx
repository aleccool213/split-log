import { formatDate, formatMetersFull, formatSplit, formatWorkTime } from "@/lib/format";
import type { Workout } from "@/lib/workouts";
import { inferredSplit } from "@/lib/workouts";
import { ShareButton } from "@/components/share-button";
import { shareWorkoutPayload } from "@/lib/share";

export function SessionRow({ workout }: { workout: Workout }) {
  const split = inferredSplit(workout);
  return (
    <article className="flex items-center justify-between gap-3 border-b border-border/80 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{workout.description}</p>
        <p className="text-xs text-muted">
          {formatDate(workout.sessionDate)}
          {workout.notes ? ` · ${workout.notes}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right tabular">
          <p className="font-medium">{formatMetersFull(workout.distanceM)}</p>
          <p className="text-xs text-muted">
            {formatWorkTime(workout.workSeconds)}
            {split ? ` · ${formatSplit(split)}` : ""}
          </p>
        </div>
        <ShareButton payload={shareWorkoutPayload(workout)} label="Share session" iconOnly variant="ghost" />
      </div>
    </article>
  );
}
