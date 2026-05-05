import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  RefreshCcw
} from "lucide-react";

import { GraphCredentialsWizard } from "../components/setup/GraphCredentialsWizard.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useSettings } from "../hooks/useSettings.js";
import { useFirstRunStatus } from "../hooks/useSetup.js";
import { useSyncStatus, useTriggerSync } from "../hooks/useSync.js";
import { useTimestampFormatter } from "../hooks/useTimestampFormatter.js";

interface StepShellProps {
  number: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}

function StepShell({ number, title, description, done, active, children }: StepShellProps) {
  return (
    <Card
      className={`p-4 transition-opacity ${done && !active ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
            done
              ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
              : active
                ? "bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]"
                : "bg-[var(--pc-tint-subtle)] text-[var(--pc-text-muted)]"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--pc-text)]">{title}</div>
          <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[var(--pc-text-muted)]">{description}</div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export function SetupPage() {
  const settings = useSettings();
  const sync = useSyncStatus();
  const firstRun = useFirstRunStatus();
  const triggerSync = useTriggerSync();
  const formatTimestamp = useTimestampFormatter();

  if (settings.isLoading) return <LoadingState label="Loading setup…" />;
  if (settings.isError || !settings.data) {
    return (
      <ErrorState
        title="Could not load setup"
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
    );
  }

  const graphConfigured = settings.data.graph.configured;
  const hasSync = firstRun.data?.successfulSyncCompleted ?? Boolean(sync.data?.lastCompletedAt);
  const hasDeviceRows = firstRun.data?.deviceRowsPresent ?? false;

  // Active step is the first incomplete one.
  const syncReady = hasSync && hasDeviceRows;
  const activeStep = !graphConfigured ? 1 : !syncReady ? 2 : 3;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welcome"
        title="First-run Setup"
        description="Connect the tenant and run the initial sync. Tag mappings can be added later from Tags."
      />

      {/* Progress stepper */}
      <SetupStepper activeStep={activeStep} />

      <StepShell
        number={1}
        title="Connect Entra tenant"
        description="Add tenant ID, client ID, and client secret."
        done={graphConfigured}
        active={activeStep === 1}
      >
        <GraphCredentialsWizard
          onDismissRestart={() => settings.refetch()}
        />
      </StepShell>

      <StepShell
        number={2}
        title="Run the initial sync"
        description="One sync verifies Graph permissions and imports device data."
        done={syncReady}
        active={activeStep === 2}
      >
        <div className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <Database className="h-4 w-4 text-[var(--pc-accent)]" />
          <div className="flex-1 text-[12px] text-[var(--pc-text-secondary)]">
            {syncReady
              ? `Permissions verified and device data imported${sync.data?.lastCompletedAt ? ` ${formatTimestamp(sync.data.lastCompletedAt)}` : ""}.`
              : hasSync
                ? "Sync completed, but no device rows imported yet. Re-sync if your tenant has Autopilot or Intune devices."
                : "Run a sync to confirm permissions and pull devices into the local cache."}
          </div>
          <Button
            onClick={() => triggerSync.mutate()}
            disabled={!sync.data?.canTriggerManualSync || triggerSync.isPending || sync.data?.inProgress}
            title={sync.data?.canTriggerManualSync ? undefined : "Admin sign-in required to run sync"}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {sync.data?.inProgress ? "Syncing..." : syncReady ? "Re-sync" : hasSync ? "Re-sync" : "Run initial sync"}
          </Button>
        </div>
        {!sync.data?.canTriggerManualSync ? (
          <div className="mt-2 rounded-lg border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3 py-2 text-[11.5px] text-[var(--pc-warning)]">
            Manual sync requires delegated admin sign-in.
          </div>
        ) : null}
      </StepShell>

      <StepShell
        number={3}
        title={activeStep === 3 ? "Setup complete" : "Finish setup"}
        description={
          activeStep === 3
            ? "Head to Overview to start triaging."
            : "Complete the required setup steps before triaging live data."
        }
        done={activeStep === 3}
        active={activeStep === 3}
      >
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button>
              Go to Overview
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {activeStep !== 3 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--pc-text-muted)]">
              <CircleDashed className="h-3 w-3" />
              Finish the steps above first
            </span>
          ) : null}
        </div>
      </StepShell>
    </div>
  );
}

const STEPPER_LABELS = ["Tenant", "Initial sync", "Ready"];

function SetupStepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex items-center gap-1" role="list" aria-label="Setup progress">
      {STEPPER_LABELS.map((label, index) => {
        const step = index + 1;
        const done = step < activeStep;
        const current = step === activeStep;
        return (
          <div key={label} className="flex flex-1 items-center gap-1" role="listitem">
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  done
                    ? "bg-[var(--pc-healthy)]"
                    : current
                      ? "bg-[var(--pc-accent)]"
                      : "bg-[var(--pc-tint-hover)]"
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  done
                    ? "text-[var(--pc-healthy)]"
                    : current
                      ? "text-[var(--pc-accent-hover)]"
                      : "text-[var(--pc-text-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
