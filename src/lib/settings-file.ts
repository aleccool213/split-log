import { z } from "zod";
import raw from "../../data/settings.json?raw";

export const LOCAL_SETTINGS_FILE = "data/settings.json";

const schema = z.object({
  reminderEnabled: z.boolean(),
  reminderDays: z.number().int().min(1).max(14),
  reminderTo: z.union([z.string().trim().email(), z.literal("")]).optional(),
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

export function loadFileSettings(): FileSettings {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    return {
      reminderEnabled: parsed.data.reminderEnabled,
      reminderDays: parsed.data.reminderDays,
      reminderTo: parsed.data.reminderTo ?? "",
    };
  } catch {
    return fallback;
  }
}
