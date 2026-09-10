export const THEME_KEY = "split-log-theme";

export type ThemePref = "light" | "dark" | "system";

export function readThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolvedDark(pref: ThemePref = readThemePref()): boolean {
  return pref === "dark" || (pref === "system" && systemPrefersDark());
}

export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const dark = resolvedDark(pref);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#121614" : "#F3EFE6");
}

export function persistTheme(pref: ThemePref): void {
  window.localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}
