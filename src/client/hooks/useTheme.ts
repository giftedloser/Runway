import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

export type Theme = "system" | "canopy-light" | "oled" | "slate" | "studio";
export type AppliedTheme = Exclude<Theme, "system">;

export const THEMES: Theme[] = ["system", "canopy-light", "oled", "slate", "studio"];
export const DEFAULT_THEME: Theme = "system";
export const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  "canopy-light": "Canopy Light",
  oled: "OLED",
  slate: "Slate",
  studio: "Studio"
};

const DARK_SCHEME_THEMES = new Set<AppliedTheme>(["oled", "slate"]);
let currentTheme: Theme = DEFAULT_THEME;
const subscribers = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

export function appThemeToLocalTheme(value: string): Theme {
  if (value === "light") return "canopy-light";
  if (value === "dark") return "oled";
  return isTheme(value) ? value : DEFAULT_THEME;
}

function subscribeToTheme(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function getThemeSnapshot() {
  return currentTheme;
}

function setThemeSnapshot(value: Theme) {
  if (currentTheme === value) return;
  currentTheme = value;
  for (const subscriber of subscribers) {
    subscriber();
  }
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
    return "oled";
  }
  return "canopy-light";
}

export function useTheme(): [Theme, () => Theme, AppliedTheme, (value: Theme) => void] {
  const theme = useSyncExternalStore<Theme>(
    subscribeToTheme,
    getThemeSnapshot,
    () => DEFAULT_THEME
  );
  const systemTheme = useSyncExternalStore<AppliedTheme>(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "canopy-light"
  );

  const resolved = useMemo<AppliedTheme>(
    () => (theme === "system" ? systemTheme : (theme as AppliedTheme)),
    [systemTheme, theme]
  );

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const cycle = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setThemeSnapshot(next);
    return next;
  }, [theme]);

  return [theme, cycle, resolved, setThemeSnapshot];
}
