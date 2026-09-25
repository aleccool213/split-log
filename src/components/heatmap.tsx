import { useMemo } from "react";
import { OmActivityHeatmap } from "@omarchy/ui/react";
import { formatDate } from "@/lib/format";
import { TZ, type Workout } from "@/lib/workouts";

// The calendar grid, month labels, level buckets and legend come from
// OmActivityHeatmap; this only sums meters per day and says how a day reads.
export function MeterHeatmap({ workouts }: { workouts: Workout[] }) {
  const meters = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const w of workouts) {
      byDay.set(w.sessionDate, (byDay.get(w.sessionDate) ?? 0) + w.distanceM);
    }
    return byDay;
  }, [workouts]);

  return (
    <OmActivityHeatmap
      values={meters}
      weeks={16}
      timeZone={TZ}
      noun={["meter", "meters"]}
      format="locale"
      caption="Tap a square for the day."
      formatTip={({ date, value }) =>
        `${formatDate(date)} · ${value > 0 ? `${value.toLocaleString("en-CA")} m` : "rest"}`
      }
    />
  );
}
