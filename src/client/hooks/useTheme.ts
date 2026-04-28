import { useCallback, useEffect } from "react";

import { usePreference } from "./usePreference.js";

export type Theme = "canopy-light" | "canopy-dark" | "carbon" | "studio";
export type AppliedTheme = Theme;

const THEMES: Theme[] = ["canopy-light", "canopy-dark", "carbon", "studio"];
const DEFAULT_THEME: Theme = "canopy-light";
const DARK_SCHEME_THEMES = new Set<AppliedTheme>(["canopy-dark", "carbon"]);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

function applyTheme(resolved: AppliedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = DARK_SCHEME_THEMES.has(resolved) ? "dark" : "light";
}

export function useTheme(): [Theme, () => void, AppliedTheme] {
  const [storedTheme, setTheme] = usePreference<Theme>("theme", DEFAULT_THEME);
  const theme = isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;

  const resolved = theme;

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const cycle = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  }, [theme, setTheme]);

  return [theme, cycle, resolved];
}
