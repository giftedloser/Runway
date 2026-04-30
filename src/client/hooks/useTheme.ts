import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { usePreference } from "./usePreference.js";

export type Theme = "system" | "canopy-light" | "canopy-dark";
export type AppliedTheme = Exclude<Theme, "system">;

const THEMES: Theme[] = ["system", "canopy-light", "canopy-dark"];
const DEFAULT_THEME: Theme = "system";
const DARK_SCHEME_THEMES = new Set<AppliedTheme>(["canopy-dark"]);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

function applyTheme(resolved: AppliedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = DARK_SCHEME_THEMES.has(resolved) ? "dark" : "light";
}

function subscribeToSystemTheme(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemTheme(): AppliedTheme {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "canopy-dark";
  }
  return "canopy-light";
}

export function useTheme(): [Theme, () => void, AppliedTheme, (value: Theme) => void] {
  const [storedTheme, setTheme] = usePreference<Theme>("theme", DEFAULT_THEME);
  const theme = isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  const systemTheme = useSyncExternalStore<AppliedTheme>(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "canopy-light"
  );

  const resolved = useMemo<AppliedTheme>(
    () => (theme === "system" ? systemTheme : (theme as AppliedTheme)),
    [systemTheme, theme]
  );

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const cycle = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  }, [theme, setTheme]);

  return [theme, cycle, resolved, setTheme];
}
