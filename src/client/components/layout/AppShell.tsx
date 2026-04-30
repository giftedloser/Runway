import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { CommandPalette } from "../command/CommandPalette.js";
import { KeyboardShortcuts } from "../command/KeyboardShortcuts.js";
import { ToastProvider } from "../shared/toast.js";
import { MockModeBanner } from "./MockModeBanner.js";
import { Sidebar } from "./Sidebar.js";
import { UnauthenticatedListener } from "./UnauthenticatedListener.js";
import { useAppAccessLogout, useAppAccessStatus, useAuthStatus, useLogout } from "../../hooks/useAuth.js";
import { useSettings } from "../../hooks/useSettings.js";
import { useTheme, type Theme } from "../../hooks/useTheme.js";

const LANDING_ROUTES: Record<string, "/devices" | "/tags" | "/provisioning"> = {
  devices: "/devices",
  tags: "/tags",
  provisioning: "/provisioning"
};

function settingValue<T>(settings: ReturnType<typeof useSettings>, key: string, fallback: T): T {
  const setting = settings.data?.appSettings.find((item) => item.key === key);
  return (setting?.value as T | undefined) ?? fallback;
}

function appThemeToLocalTheme(value: string): Theme {
  if (value === "light") return "canopy-light";
  if (value === "dark") return "canopy-dark";
  return "system";
}

function SettingsBehaviorController() {
  const settings = useSettings();
  const [, , , setTheme] = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const redirectedOnBootRef = useRef(false);

  const appAccess = useAppAccessStatus();
  const auth = useAuthStatus();
  const appAccessLogout = useAppAccessLogout();
  const adminLogout = useLogout();
  const hasActiveSession =
    appAccess.data?.authenticated === true || auth.data?.authenticated === true;

  useEffect(() => {
    const theme = settingValue(settings, "display.theme", "system");
    setTheme(appThemeToLocalTheme(theme));
  }, [settings.data?.appSettings, setTheme]);

  useEffect(() => {
    if (redirectedOnBootRef.current || settings.isLoading) return;
    if (pathname !== "/") return;

    redirectedOnBootRef.current = true;
    const landing = settingValue(settings, "display.defaultLandingScreen", "devices");
    const route = LANDING_ROUTES[landing] ?? "/devices";
    void navigate({ to: route, replace: true });
  }, [navigate, pathname, settings]);

  useEffect(() => {
    const timeoutMinutes = settingValue(settings, "security.sessionTimeoutMinutes", 60);
    if (!hasActiveSession || !Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
      return;
    }

    let timer: number | undefined;
    const logout = () => {
      if (appAccess.data?.authenticated) {
        appAccessLogout.mutate();
      } else if (auth.data?.authenticated) {
        adminLogout.mutate();
      }
    };
    const resetTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(logout, timeoutMinutes * 60_000);
    };
    const events = ["keydown", "mousedown", "mousemove", "scroll", "touchstart", "visibilitychange"];

    resetTimer();
    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [
    appAccess.data?.authenticated,
    appAccessLogout,
    auth.data?.authenticated,
    adminLogout,
    hasActiveSession,
    settings.data?.appSettings,
    settings.isLoading
  ]);

  return null;
}

export function AppShell() {
  // In the desktop shell, scroll below the custom title bar so the root
  // scrollbar never reserves a gutter beside the window controls.
  return (
    <ToastProvider>
      <UnauthenticatedListener />
      <SettingsBehaviorController />
      <a href="#main-content" className="pc-skip-link">
        Skip to Main Content
      </a>
      <div className="mt-[var(--pc-titlebar-height,0px)] flex h-[calc(100vh-var(--pc-titlebar-height,0px))] flex-col overflow-y-auto bg-[var(--pc-bg)]">
        <MockModeBanner />
        <div className="flex flex-1 flex-col lg:flex-row lg:items-start lg:pl-[218px]">
          <Sidebar />
          <main
            id="main-content"
            className="min-w-0 flex-1 overflow-x-hidden bg-[linear-gradient(180deg,var(--pc-tint-subtle),transparent_24rem)]"
          >
            <div className="pc-page-enter mx-auto w-full max-w-[1680px] px-3 pb-12 pt-3 sm:px-5 lg:px-6 lg:pb-16 lg:pt-5 xl:px-7">
              <Outlet />
            </div>
          </main>
        </div>
        <CommandPalette />
        <KeyboardShortcuts />
      </div>
    </ToastProvider>
  );
}
