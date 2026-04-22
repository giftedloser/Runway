import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/shared/toast.js";
import type { AuthStatus } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";
import { useSettings } from "./useSettings.js";

const AUTH_WINDOW_POLL_INTERVAL_MS = 1_000;
const AUTH_WINDOW_TIMEOUT_MS = 120_000;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForDesktopAuth(popup: Window) {
  const deadline = Date.now() + AUTH_WINDOW_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await apiRequest<AuthStatus>("/api/auth/status").catch(() => null);
    if (status?.authenticated) {
      return status;
    }

    if (popup.closed) {
      break;
    }

    await delay(AUTH_WINDOW_POLL_INTERVAL_MS);
  }

  return (await apiRequest<AuthStatus>("/api/auth/status").catch(() => null)) ?? null;
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => apiRequest<AuthStatus>("/api/auth/status"),
    refetchInterval: 60_000,
    staleTime: 30_000
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

      const { loginUrl } = await apiRequest<{ loginUrl: string }>("/api/auth/login");
      const popup = window.open(loginUrl, "_blank", "popup=yes,width=640,height=760");
      if (!popup) {
        throw new Error("Runway could not open the Microsoft sign-in window.");
      }
      popup.focus();
      return popup;
    },
    onSuccess: (popup) => {
      toast.push({
        variant: "info",
        title: "Continue in Microsoft sign-in",
        description: "Finish the delegated admin sign-in in the opened window."
      });

      void (async () => {
        const status = await waitForDesktopAuth(popup);
        if (status?.authenticated) {
          await queryClient.invalidateQueries({ queryKey: ["auth", "status"] });
          toast.push({
            variant: "success",
            title: "Admin sign-in complete",
            description: status.user ?? "Delegated admin session is active."
          });
          return;
        }

        if (!popup.closed) {
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
