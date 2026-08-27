import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  caloriesFromWatts,
  formatSplit,
  parseWorkTime,
  splitFromWork,
  todayISO,
  wattsFromSplit,
} from "@/lib/format";
import { logWorkout } from "@/lib/workouts.functions";
import { TZ } from "@/lib/workouts";

const PRESETS = [
  { label: "Just Row", description: "Just Row", distance: "" },
  { label: "2k", description: "2,000m test", distance: "2000" },
  { label: "5k", description: "5,000m", distance: "5000" },
  { label: "10k", description: "10,000m", distance: "10000" },
  { label: "30 min", description: "30 min steady", distance: "" },
  { label: "8×500", description: "8x500m/1:00r", distance: "4000" },
] as const;

export function WorkoutForm() {
  const router = useRouter();
  const logFn = useServerFn(logWorkout);
  const [date, setDate] = useState(() => todayISO(TZ));
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[2]);
  const [description, setDescription] = useState("5,000m");
  const [distance, setDistance] = useState("5000");
  const [workTime, setWorkTime] = useState("20:28.0");
  const [spm, setSpm] = useState("22");
  const [hr, setHr] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    const meters = Number(distance);
    const seconds = parseWorkTime(workTime);
    if (!meters || !seconds) return null;
    const split = splitFromWork(meters, seconds);
    const watts = split ? wattsFromSplit(split) : null;
    const cals = watts ? caloriesFromWatts(watts, seconds) : null;
    return { split, watts, cals };
  }, [distance, workTime]);

  function applyPreset(next: (typeof PRESETS)[number]) {
    setPreset(next);
    setDescription(next.description);
    if (next.distance) setDistance(next.distance);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const distanceM = Number(distance);
    const strokeRate = spm.trim() ? Number(spm) : null;
    const avgHr = hr.trim() ? Number(hr) : null;
    if (!Number.isFinite(distanceM)) {
      toast.error("Distance needs to be a number of meters.");
      return;
    }
    setPending(true);
    try {
      await logFn({
        data: {
          sessionDate: date,
          description: description.trim() || "Just Row",
          workTime,
          distanceM,
          strokeRate: strokeRate && Number.isFinite(strokeRate) ? strokeRate : null,
          avgHr: avgHr && Number.isFinite(avgHr) ? avgHr : null,
          notes: notes.trim(),
        },
      });
      toast.success("Session logged.");
      await router.invalidate({ sync: true });
      await router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that session.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className={
              preset.label === p.label
                ? "h-9 rounded-full bg-primary px-3 text-xs font-medium text-primary-fg"
                : "h-9 rounded-full bg-surface px-3 text-xs font-medium text-fg"
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        <Field label="Distance (m)">
          <Input
            inputMode="numeric"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="5000"
            required
          />
        </Field>
        <Field label="Work time">
          <Input
            value={workTime}
            onChange={(e) => setWorkTime(e.target.value)}
            placeholder="20:28.0"
            required
          />
        </Field>
        <Field label="Stroke rate">
          <Input inputMode="numeric" value={spm} onChange={(e) => setSpm(e.target.value)} placeholder="22" />
        </Field>
        <Field label="Average HR">
          <Input inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="optional" />
        </Field>
      </div>

      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How it felt" />
      </Field>

      {preview && (
        <p className="rounded-lg bg-surface px-4 py-3 text-sm text-muted tabular">
          Split {formatSplit(preview.split)} /500m
          {preview.watts ? ` · ${preview.watts} W` : ""}
          {preview.cals ? ` · ${preview.cals} cal` : ""}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Save session"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
