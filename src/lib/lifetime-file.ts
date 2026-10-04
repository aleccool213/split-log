import raw from "../../data/lifetime.json?raw";
import { parseLifetime, type LifetimeStats } from "@/lib/lifetime";

/** Snapshot copied from the PM5 Summary screen; null when missing or malformed. */
export function loadLifetime(): LifetimeStats | null {
  return parseLifetime(raw);
}
