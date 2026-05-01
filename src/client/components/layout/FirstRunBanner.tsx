import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, X } from "lucide-react";

import { useFirstRunStatus } from "../../hooks/useSetup.js";
import { Button } from "../ui/button.js";

const DISMISS_KEY = "runway.firstRunBanner.dismissedAt";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function isDismissedTemporarily() {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(DISMISS_KEY) ?? window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS;
}

export function FirstRunBanner() {
  const firstRun = useFirstRunStatus();
  const [hidden, setHidden] = useState(() => isDismissedTemporarily());

  useEffect(() => {
    if (firstRun.data?.complete) {
      window.sessionStorage.removeItem(DISMISS_KEY);
      window.localStorage.removeItem(DISMISS_KEY);
    }
  }, [firstRun.data?.complete]);

  if (firstRun.isLoading || firstRun.isError || !firstRun.data || firstRun.data.complete || hidden) {
    return null;
  }

  const dismiss = () => {
    const now = String(Date.now());
    window.sessionStorage.setItem(DISMISS_KEY, now);
    setHidden(true);
  };

  return (
    <div className="mb-3 rounded-[var(--pc-radius)] border border-[var(--pc-warning)]/35 bg-[var(--pc-warning-muted)] px-4 py-3 text-[12px] text-[var(--pc-warning)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-[var(--pc-text)]">
              Welcome to Runway. Connect your tenant and run an initial sync to get started.
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              <span>{firstRun.data.graphCredentialsPresent ? "Tenant connected" : "Tenant not connected"}</span>
              <span>{firstRun.data.successfulSyncCompleted ? "Initial sync complete" : "Initial sync needed"}</span>
              <span>{firstRun.data.deviceRowsPresent ? "Devices present" : "No devices yet"}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/setup">
            <Button className="h-8 px-2.5 text-[11.5px]">
              Go to Setup
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--pc-radius-sm)] border border-[var(--pc-warning)]/35 px-2.5 text-[11.5px] font-medium transition-colors hover:bg-[var(--pc-warning-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          >
            <X className="h-3.5 w-3.5" />
            Remind later
          </button>
        </div>
      </div>
    </div>
  );
}
