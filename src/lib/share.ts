import { formatDate, formatMetersFull, formatSplit, formatWorkTime } from "@/lib/format";
import { inferredSplit, type Workout } from "@/lib/workouts";

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

export function boardUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/`;
}

export function shareBoardPayload(): SharePayload {
  return {
    title: "Alec Brunelle’s rowing tracker",
    text: "Alec Brunelle’s Concept 2 rowing tracker — splits, volume, and the season.",
    url: boardUrl(),
  };
}

export function shareWorkoutPayload(workout: Workout): SharePayload {
  const split = inferredSplit(workout);
  const bits = [
    workout.description,
    formatMetersFull(workout.distanceM),
    `in ${formatWorkTime(workout.workSeconds)}`,
  ];
  if (split) bits.push(`at ${formatSplit(split)} /500m`);
  if (workout.strokeRate) bits.push(`${workout.strokeRate} spm`);
  const line = bits.join(" · ");
  return {
    title: `${workout.description} — Alec Brunelle’s rowing tracker`,
    text: `Alec Brunelle’s rowing tracker\n${formatDate(workout.sessionDate)}\n${line}`,
    url: boardUrl(),
  };
}

export async function sharePayload(payload: SharePayload): Promise<"shared" | "copied" | "dismissed"> {
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare({ title: payload.title, text: payload.text, url: payload.url }));

  if (canShare) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "dismissed";
    }
  }

  const blob = `${payload.text}\n${payload.url}`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(blob);
    return "copied";
  }
  throw new Error("Share is not available on this device.");
}
