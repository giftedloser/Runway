import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { UNAUTHENTICATED_EVENT, type UnauthenticatedEventDetail } from "../../lib/api.js";
import { useToast } from "../shared/toast.js";

// Suppress duplicate toasts when a burst of background queries all 401 at once
// (e.g. every TanStack Query retries once by default, so a single expiry can
// easily fire this event multiple times in the same tick).
const TOAST_COOLDOWN_MS = 5_000;

export function UnauthenticatedListener() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const lastToastAtRef = useRef(0);

  useEffect(() => {
    function handleUnauthenticated(event: Event) {
      const detail = (event as CustomEvent<UnauthenticatedEventDetail>).detail;

      // Force auth status refetch so AuthIndicator / gated routes update.
      void queryClient.invalidateQueries({ queryKey: ["auth", "status"] });

      const now = Date.now();
      if (now - lastToastAtRef.current < TOAST_COOLDOWN_MS) {
        return;
      }
      lastToastAtRef.current = now;

      toast.push({
        variant: "warning",
        title: "Admin sign-in required",
        description: detail?.message ?? "Sign in again to continue managing devices."
      });
    }

    window.addEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
  }, [queryClient, toast]);

  return null;
}
