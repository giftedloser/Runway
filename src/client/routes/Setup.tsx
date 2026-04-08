import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  KeyRound,
  RefreshCcw,
  Tag
} from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { useSettings, useTagConfigMutations } from "../hooks/useSettings.js";
import { useSyncStatus, useTriggerSync } from "../hooks/useSync.js";

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
      className={`p-5 transition-opacity ${done && !active ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
            done
              ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
              : active
                ? "bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]"
                : "bg-white/[0.04] text-[var(--pc-text-muted)]"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">{description}</div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export function SetupPage() {
  const settings = useSettings();
  const sync = useSyncStatus();
  const triggerSync = useTriggerSync();
  const mutations = useTagConfigMutations();
  const [tagForm, setTagForm] = useState({
    groupTag: "",
    propertyLabel: "",
    expectedProfileNames: "",
    expectedGroupNames: ""
  });

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
  const hasMappings = settings.data.tagConfig.length > 0;
  const hasSync = Boolean(sync.data?.lastCompletedAt);

  // Active step is the first incomplete one.
  const activeStep = !graphConfigured ? 1 : !hasSync ? 2 : !hasMappings ? 3 : 4;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welcome"
        title="First-run Setup"
        description="Walk through these steps to take PilotCheck from a fresh install to a working ingestion of your Windows Autopilot, Intune, and Entra ID data. You can skip ahead at any time and revisit Settings later."
      />

      <StepShell
        number={1}
        title="Graph credentials"
        description="PilotCheck reads from Microsoft Graph using a read-only app registration."
        done={graphConfigured}
        active={activeStep === 1}
      >
        <div className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <KeyRound className="h-4 w-4 text-[var(--pc-accent)]" />
          <div className="flex-1 text-[12px] text-[var(--pc-text-secondary)]">
            {graphConfigured
              ? "Server-side credentials detected. PilotCheck can ingest live data."
              : `Missing: ${settings.data.graph.missing.join(", ")}. Set these in the server's environment and restart.`}
          </div>
          <Link
            to="/settings"
            className="text-[12px] font-medium text-[var(--pc-accent)] hover:text-[var(--pc-accent-hover)]"
          >
            Open Settings
          </Link>
        </div>
      </StepShell>

      <StepShell
        number={2}
        title="Run your first sync"
        description="Pull Autopilot, Intune, and Entra ID data into the local cache."
        done={hasSync}
        active={activeStep === 2}
      >
        <div className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <Database className="h-4 w-4 text-[var(--pc-accent)]" />
          <div className="flex-1 text-[12px] text-[var(--pc-text-secondary)]">
            {hasSync
              ? `Last sync completed ${sync.data?.lastCompletedAt ? new Date(sync.data.lastCompletedAt).toLocaleString() : "recently"}.`
              : "No completed sync yet. The first one may take a minute."}
          </div>
          <Button
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending || sync.data?.inProgress}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {sync.data?.inProgress ? "Syncing…" : hasSync ? "Re-sync" : "Run sync"}
          </Button>
        </div>
      </StepShell>

      <StepShell
        number={3}
        title="Map a group tag"
        description="Tell the engine what each Autopilot group tag should resolve to. Without this, tag-mismatch detection cannot run."
        done={hasMappings}
        active={activeStep === 3}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
              Group tag
            </label>
            <Input
              placeholder="e.g. CG-LOBBY"
              value={tagForm.groupTag}
              onChange={(event) =>
                setTagForm((previous) => ({ ...previous, groupTag: event.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
              Property label
            </label>
            <Input
              placeholder="e.g. Casino Grand Lobby"
              value={tagForm.propertyLabel}
              onChange={(event) =>
                setTagForm((previous) => ({ ...previous, propertyLabel: event.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
              Expected profiles (comma-separated)
            </label>
            <Input
              placeholder="LOBBY-Kiosk"
              value={tagForm.expectedProfileNames}
              onChange={(event) =>
                setTagForm((previous) => ({
                  ...previous,
                  expectedProfileNames: event.target.value
                }))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
              Expected groups (comma-separated)
            </label>
            <Input
              placeholder="LOBBY-Devices"
              value={tagForm.expectedGroupNames}
              onChange={(event) =>
                setTagForm((previous) => ({
                  ...previous,
                  expectedGroupNames: event.target.value
                }))
              }
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            disabled={!tagForm.groupTag || !tagForm.propertyLabel || mutations.create.isPending}
            onClick={() =>
              mutations.create.mutate(
                {
                  groupTag: tagForm.groupTag,
                  propertyLabel: tagForm.propertyLabel,
                  expectedProfileNames: tagForm.expectedProfileNames
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  expectedGroupNames: tagForm.expectedGroupNames
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                },
                {
                  onSuccess: () =>
                    setTagForm({
                      groupTag: "",
                      propertyLabel: "",
                      expectedProfileNames: "",
                      expectedGroupNames: ""
                    })
                }
              )
            }
          >
            <Tag className="h-3.5 w-3.5" />
            {mutations.create.isPending ? "Saving…" : "Save mapping"}
          </Button>
          {hasMappings ? (
            <span className="text-[11px] text-[var(--pc-text-muted)]">
              {settings.data.tagConfig.length} mapping
              {settings.data.tagConfig.length === 1 ? "" : "s"} configured
            </span>
          ) : null}
        </div>
      </StepShell>

      <StepShell
        number={4}
        title="You're set"
        description="Head to the dashboard to start triaging."
        done={activeStep === 4}
        active={activeStep === 4}
      >
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button>
              Go to dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {activeStep !== 4 ? (
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
