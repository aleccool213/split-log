import { addDaysISO, mondayOf, todayISO } from "@/lib/format";
import { TZ, type Workout } from "@/lib/workouts";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function MeterHeatmap({ workouts }: { workouts: Workout[] }) {
  const today = todayISO(TZ);
  const thisMonday = mondayOf(today);
  const start = addDaysISO(thisMonday, -7 * 15);
  const byDay = new Map<string, number>();
  let max = 1;
  for (const w of workouts) {
    const next = (byDay.get(w.sessionDate) ?? 0) + w.distanceM;
    byDay.set(w.sessionDate, next);
    if (next > max) max = next;
  }

  const weeks: string[][] = [];
  let cursor = start;
  for (let w = 0; w < 16; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(cursor);
      cursor = addDaysISO(cursor, 1);
    }
    weeks.push(week);
  }

  function tone(meters: number, date: string): string {
    if (date > today) return "bg-transparent";
    if (meters <= 0) return "bg-surface";
    const t = meters / max;
    if (t < 0.25) return "bg-primary/25";
    if (t < 0.5) return "bg-primary/45";
    if (t < 0.75) return "bg-primary/70";
    return "bg-primary";
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-0.5 text-[10px] leading-4 text-subtle">
        {DAYS.map((d, i) => (
          <span key={`${d}-${i}`} className="h-4">
            {i % 2 === 0 ? d : ""}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {weeks.map((week) => (
          <div key={week[0]} className="flex flex-col gap-1">
            {week.map((date) => {
              const meters = byDay.get(date) ?? 0;
              return (
                <Tooltip key={date}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn("size-3.5 rounded-none sm:size-4", tone(meters, date))}
                      aria-label={`${date}: ${meters} meters`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {date} · {meters > 0 ? `${meters.toLocaleString("en-CA")} m` : "rest"}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
