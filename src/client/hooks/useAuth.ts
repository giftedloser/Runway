import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/shared/toast.js";
import type { AppAccessStatus, AuthStatus } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";
import { isTauriRuntime, openUrlInSystemBrowser } from "../lib/desktop.js";
import { useSettings } from "./useSettings.js";

const AUTH_WINDOW_POLL_INTERVAL_MS = 1_000;
const AUTH_WINDOW_TIMEOUT_MS = 120_000;
const AUTH_CALLBACK_GRACE_MS = 5_000;
const AUTH_COMPLETE_MESSAGE = "pilotcheck-auth-complete";
const APP_ACCESS_COMPLETE_MESSAGE = "pilotcheck-access-auth-complete";
const AUTH_POPUP_FEATURES = "popup=yes,width=640,height=760";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function primeAuthPopup({
  windowName,
  title,
  description
}: {
  windowName: string;
  title: string;
  description: string;
}) {
  const popup = window.open("", windowName, AUTH_POPUP_FEATURES);
  if (!popup) return null;

  try {
    popup.document.title = title;
    popup.document.body.style.margin = "0";
    popup.document.body.innerHTML = `
      <main style="
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0f1720;
        color: #e5eef8;
        font: 14px/1.5 Segoe UI, sans-serif;
      ">
        <section style="
          width: min(420px, calc(100vw - 32px));
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          background: rgba(15, 23, 32, 0.96);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        ">
          <h1 style="margin: 0 0 8px; font-size: 18px;">${title}</h1>
          <p style="margin: 0; color: #b6c3d1;">${description}</p>
        </section>
      </main>
    `;
  } catch {
    // Some shells restrict writing to the popup. The opened window is still usable.
  }

  popup.focus();
  return popup;
}

async function waitForDesktopAuth<T extends { authenticated: boolean }>(
  popup: Window | null,
  {
    statusPath,
    messageType
  }: {
    statusPath: string;
    messageType: string;
  }
) {
  // popup is null in Tauri mode (the auth window is a separate Tauri
  // WebviewWindow with no JS handle). In that case we drop the
  // closed/postMessage signals and rely purely on polling
  // /api/auth/status until the deadline.
  const deadline = Date.now() + AUTH_WINDOW_TIMEOUT_MS;
  let completedByCallback = false;
  let callbackDeadline: number | null = null;

  const onMessage = (event: MessageEvent) => {
    if (!popup || event.source !== popup) return;
    const payload = event.data as { type?: string } | null;
    if (payload?.type === messageType) {
      completedByCallback = true;
      callbackDeadline = Date.now() + AUTH_CALLBACK_GRACE_MS;
    }
  };

  window.addEventListener("message", onMessage);

  try {
    while (Date.now() < Math.min(deadline, callbackDeadline ?? deadline)) {
      const status = await apiRequest<T>(statusPath).catch(() => null);
      if (status?.authenticated) {
        return status;
      }

      if (popup && popup.closed && !completedByCallback) {
        break;
      }

      await delay(completedByCallback ? 150 : AUTH_WINDOW_POLL_INTERVAL_MS);
    }

    return (await apiRequest<T>(statusPath).catch(() => null)) ?? null;
  } finally {
    window.removeEventListener("message", onMessage);
  }
}

/**
 * Result handle for an in-flight sign-in attempt. In browser mode this
 * wraps a Window we own (so we can close it on error and detect when
 * the user closes it manually). In Tauri mode the auth window is a
 * separate WebviewWindow with no JS handle — we just poll status.
 */
type AuthHandle =
  | { kind: "popup"; window: Window }
  | { kind: "browser" };

function closeAuthHandle(handle: AuthHandle | null) {
  if (!handle) return;
  if (handle.kind === "popup") {
    try {
      handle.window.close();
    } catch {
      /* ignore */
    }
  }
  // System-browser auth windows close themselves from the callback HTML;
  // if the user aborts before completion we leave that to them.
}

async function startAuthFlow({
  loginPath,
  windowName,
  primeTitle,
  primeDescription
}: {
  loginPath: string;
  windowName: string;
  primeTitle: string;
  primeDescription: string;
}): Promise<AuthHandle> {
  // In Tauri, window.open is not allowed by the WebView2 host. Instead
  // of opening a separate WebView2 window (which is unreliable with
  // Microsoft login due to UA sniffing / blank windows), we open the
  // login URL in the system's default browser. The browser completes
  // the OAuth flow and hits the localhost callback endpoint directly,
  // which creates the session server-side. The frontend polls
  // /api/auth/status to detect the completed login.
  if (isTauriRuntime()) {
    const { loginUrl } = await apiRequest<{ loginUrl: string }>(loginPath);
    const opened = await openUrlInSystemBrowser(loginUrl);
    if (!opened) {
      throw new Error(
        "Runway could not open the system browser for Microsoft sign-in."
      );
    }
    return { kind: "browser" };
  }

  // Browser fallback: open the popup synchronously inside the user
  // gesture so it isn't classified as a non-user-initiated popup, then
  // navigate it to the login URL once we have it.
  const popup = primeAuthPopup({
    windowName,
    title: primeTitle,
    description: primeDescription
  });
  if (!popup) {
    throw new Error(
      "Runway could not open the Microsoft sign-in window. Allow popups for this app and try again."
    );
  }

  try {
    const { loginUrl } = await apiRequest<{ loginUrl: string }>(loginPath);
    popup.location.href = loginUrl;
  } catch (error) {
    popup.close();
    throw error;
  }

  popup.focus();
  return { kind: "popup", window: popup };
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => apiRequest<AuthStatus>("/api/auth/status"),
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

export function useAppAccessStatus() {
  return useQuery({
    queryKey: ["auth", "access-status"],
    queryFn: () => apiRequest<AppAccessStatus>("/api/auth/access-status"),
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

export function useAppAccessLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const handle = await startAuthFlow({
        loginPath: "/api/auth/access-login",
        windowName: "runway-app-signin",
        primeTitle: "Preparing Runway sign-in",
        primeDescription: "Runway is opening Microsoft Entra ID for app access."
      });

      try {
        const status = await waitForDesktopAuth<AppAccessStatus>(
          handle.kind === "popup" ? handle.window : null,  /* browser mode: no popup ref */
          {
            statusPath: "/api/auth/access-status",
            messageType: APP_ACCESS_COMPLETE_MESSAGE
          }
        );
        if (!status?.authenticated) {
          throw new Error("Runway did not receive a completed app sign-in.");
        }
        await queryClient.invalidateQueries({ queryKey: ["auth", "access-status"] });
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
        return status;
      } catch (error) {
        closeAuthHandle(handle);
        throw error;
      }
    }
  });
}

export function useLogin() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const canStart = settings.data?.graph.configured === true;
  const blockedReason = settings.isLoading
    ? "Runway is still loading its Graph configuration."
    : canStart
      ? null
      : `Microsoft Graph sign-in is unavailable in mock mode. Missing: ${(settings.data?.graph.missing ?? []).join(", ")}.`;

  const mutation = useMutation({
    mutationFn: async () => {
      if (blockedReason) {
        throw new Error(blockedReason);
      }

      return startAuthFlow({
        loginPath: "/api/auth/login",
        windowName: "runway-admin-signin",
        primeTitle: "Preparing Microsoft sign-in",
        primeDescription: "Runway is opening the delegated admin session."
      });
    },
    onSuccess: (handle) => {
      toast.push({
        variant: "info",
        title: "Continue in Microsoft sign-in",
        description: "Finish the delegated admin sign-in in the opened window."
      });

      void (async () => {
        const status = await waitForDesktopAuth<AuthStatus>(
          handle.kind === "popup" ? handle.window : null,  /* browser mode: no popup ref */
          {
            statusPath: "/api/auth/status",
            messageType: AUTH_COMPLETE_MESSAGE
          }
        );
        if (status?.authenticated) {
          await queryClient.invalidateQueries({ queryKey: ["auth", "status"] });
          toast.push({
            variant: "success",
            title: "Admin sign-in complete",
            description: status.user ?? "Delegated admin session is active."
          });
          return;
        }

        const popupAborted = handle.kind === "popup" && handle.window.closed;
        // In system-browser mode we can't detect if the user closed
        // the tab, so we always rely on the polling timeout.
        if (!popupAborted) {
          toast.push({
            variant: "warning",
            title: "Sign-in still pending",
            description: "Runway did not receive a completed admin session yet."
          });
        }
      })();
    },
    onError: (error) => {
      toast.push({
        variant: "error",
        title: "Admin sign-in unavailable",
        description: error instanceof Error ? error.message : "Could not start Microsoft sign-in."
      });
    }
  });

  return {
    ...mutation,
    canStart,
    blockedReason
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ authenticated: boolean }>("/api/auth/logout", {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "status"] });
    }
  });
}

export function useAppAccessLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ authenticated: boolean }>("/api/auth/access-logout", {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });
}
