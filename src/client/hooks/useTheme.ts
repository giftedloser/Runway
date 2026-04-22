import { useCallback, useEffect } from "react";

import { usePreference } from "./usePreference.js";

export type Theme = "dark" | "light" | "ocean" | "copper" | "system";
export type AppliedTheme = Exclude<Theme, "system">;

const THEMES: Theme[] = ["dark", "light", "ocean", "copper", "system"];
const DARK_SCHEME_THEMES = new Set<AppliedTheme>(["dark", "ocean", "copper"]);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

function resolveTheme(theme: Theme): AppliedTheme {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: AppliedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = DARK_SCHEME_THEMES.has(resolved) ? "dark" : "light";
}

export function useTheme(): [Theme, () => void, AppliedTheme] {
  const [storedTheme, setTheme] = usePreference<Theme>("theme", "dark");
  const theme = isTheme(storedTheme) ? storedTheme : "dark";

  const resolved = resolveTheme(theme);

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(resolveTheme("system"));
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const cycle = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  }, [theme, setTheme]);

  return [theme, cycle, resolved];
}
