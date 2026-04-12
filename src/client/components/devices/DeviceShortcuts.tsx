import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useRemoteAction } from "../../hooks/useActions.js";
import { useAuthStatus } from "../../hooks/useAuth.js";
import { useToast } from "../shared/toast.js";

interface DeviceShortcutsProps {
  deviceKey: string;
  deviceLabel: string;
  onRefresh: () => void;
  /** Called when the user presses `c` to copy the device summary. */
  onCopy?: () => void;
}

const DEVICES_DEFAULT_SEARCH = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
} as const;

/**
 * Single-key shortcuts for the device detail page:
 *  r → refetch device data
 *  s → sync this device (Intune check-in)
 *  b → back to device queue
 *
 * Suppressed when focus is in an input/textarea/contenteditable, or when
 * any modifier is held (so palette/system shortcuts are unaffected).
 */
export function DeviceShortcuts({ deviceKey, deviceLabel, onRefresh, onCopy }: DeviceShortcutsProps) {
  const navigate = useNavigate();
  const action = useRemoteAction();
  const auth = useAuthStatus();
  const toast = useToast();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Global KeyboardShortcuts may have already consumed this key as part
      // of a `g X` sequence — don't double-fire.
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key === "r") {
        event.preventDefault();
        onRefresh();
        toast.push({ variant: "info", title: "Refreshing device…", durationMs: 1500 });
        return;
      }

      if (event.key === "b") {
        event.preventDefault();
        navigate({ to: "/devices", search: DEVICES_DEFAULT_SEARCH });
        return;
      }

      if (event.key === "c" && onCopy) {
        event.preventDefault();
        onCopy();
        return;
      }

      if (event.key === "s") {
        event.preventDefault();
        if (!auth.data?.authenticated) {
          toast.push({
            variant: "warning",
            title: "Sign-in required",
            description: "Sync requires a delegated admin sign-in."
          });
          return;
        }
        if (action.isPending) return;
        action
          .mutateAsync({ deviceKey, action: "sync" })
          .then((result) => {
            toast.push({
              variant: result.success ? "success" : "error",
              title: result.success ? "Sync dispatched" : "Sync failed",
              description: result.message ?? `${deviceLabel} check-in requested.`
            });
          })
          .catch((error: unknown) => {
            toast.push({
              variant: "error",
              title: "Sync failed",
              description: error instanceof Error ? error.message : "Action failed."
            });
          });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [action, auth.data?.authenticated, deviceKey, deviceLabel, navigate, onCopy, onRefresh, toast]);

  return null;
}
