import { useCallback, useEffect } from "react";

import { usePreference } from "./usePreference.js";

export type Theme = "void" | "foundry" | "bone" | "oxidized";
export type AppliedTheme = Theme;

const THEMES: Theme[] = ["bone", "void", "foundry", "oxidized"];
const DARK_SCHEME_THEMES = new Set<AppliedTheme>(["void", "foundry", "oxidized"]);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

function applyTheme(resolved: AppliedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = DARK_SCHEME_THEMES.has(resolved) ? "dark" : "light";
}

export function useTheme(): [Theme, () => void, AppliedTheme] {
  const [storedTheme, setTheme] = usePreference<Theme>("theme", "bone");
  const theme = isTheme(storedTheme) ? storedTheme : "bone";

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
