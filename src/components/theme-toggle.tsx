import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { persistTheme, readThemePref, resolvedDark, type ThemePref } from "@/lib/theme";

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const next = readThemePref();
    setPref(next);
    setDark(resolvedDark(next));
  }, []);

  function toggle() {
    const next: ThemePref = dark ? "light" : "dark";
    persistTheme(next);
    setPref(next);
    setDark(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-10 items-center justify-center rounded-none text-muted transition-colors hover:bg-surface hover:text-fg"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={pref === "system" ? "Following system — tap to lock" : dark ? "Dark" : "Light"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
