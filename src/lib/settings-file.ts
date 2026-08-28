import { z } from "zod";
import raw from "../../data/settings.json?raw";

export const LOCAL_SETTINGS_FILE = "data/settings.json";

const schema = z.object({
  reminderEnabled: z.boolean(),
  reminderDays: z.number().int().min(1).max(14),
  reminderTo: z.string().optional(),
});

export type FileSettings = {
  reminderEnabled: boolean;
  reminderDays: number;
  reminderTo: string;
};

const fallback: FileSettings = {
  reminderEnabled: true,
  reminderDays: 3,
  reminderTo: "",
};

/** Accepts `name@domain`, `name at domain`, or `name [at] domain`. */
export function decodeReminderTo(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const asEmail = trimmed.replace(/\s*\[at\]\s*/i, "@").replace(/\s+at\s+/i, "@");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asEmail) ? asEmail : "";
}

export function loadFileSettings(): FileSettings {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    return {
      reminderEnabled: parsed.data.reminderEnabled,
      reminderDays: parsed.data.reminderDays,
      reminderTo: decodeReminderTo(parsed.data.reminderTo ?? ""),
    };
  } catch {
    return fallback;
  }
}
