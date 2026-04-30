import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  RefreshCcw,
  Tag,
  Trash2
} from "lucide-react";

import { GraphCredentialsWizard } from "../components/setup/GraphCredentialsWizard.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { useSettings, useTagConfigMutations } from "../hooks/useSettings.js";
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
  const triggerSync = useTriggerSync();
  const mutations = useTagConfigMutations();
  const formatTimestamp = useTimestampFormatter();
  const [tagForm, setTagForm] = useState({
    groupTag: "",
    propertyLabel: "",
    expectedProfileNames: "",
    expectedGroupNames: ""
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
        description="Configure Graph, sync data, and add the first tag mapping."
      />

      {/* Progress stepper */}
      <SetupStepper activeStep={activeStep} />

      <StepShell
        number={1}
        title="Graph credentials"
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
        title="Run your first sync"
        description="Pull Microsoft Graph signals into the local cache."
        done={hasSync}
        active={activeStep === 2}
      >
        <div className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <Database className="h-4 w-4 text-[var(--pc-accent)]" />
          <div className="flex-1 text-[12px] text-[var(--pc-text-secondary)]">
            {hasSync
              ? `Last sync completed ${sync.data?.lastCompletedAt ? formatTimestamp(sync.data.lastCompletedAt) : "recently"}.`
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
        description="Set expected property, groups, and profiles for a tag."
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
              onBlur={() => setTouched((p) => ({ ...p, groupTag: true }))}
              aria-invalid={touched.groupTag && !tagForm.groupTag.trim()}
              className="mt-1"
            />
            {touched.groupTag && !tagForm.groupTag.trim() && (
              <p className="mt-1 text-[11px] text-[var(--pc-critical)]">Group tag is required.</p>
            )}
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
              onBlur={() => setTouched((p) => ({ ...p, propertyLabel: true }))}
              aria-invalid={touched.propertyLabel && !tagForm.propertyLabel.trim()}
              className="mt-1"
            />
            {touched.propertyLabel && !tagForm.propertyLabel.trim() && (
              <p className="mt-1 text-[11px] text-[var(--pc-critical)]">Property label is required.</p>
            )}
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
                  onSuccess: () => {
                    setTagForm({
                      groupTag: "",
                      propertyLabel: "",
                      expectedProfileNames: "",
                      expectedGroupNames: ""
                    });
                    setTouched({});
                  }
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
        {hasMappings && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
              Existing mappings
            </div>
            {settings.data.tagConfig.map((tc) => (
              <div
                key={tc.groupTag}
                className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2"
              >
                <Tag className="h-3 w-3 shrink-0 text-[var(--pc-accent)]" />
                <div className="min-w-0 flex-1 text-[12px]">
                  <span className="font-mono font-medium text-[var(--pc-text)]">{tc.groupTag}</span>
                  <span className="mx-1.5 text-[var(--pc-text-muted)]">→</span>
                  <span className="text-[var(--pc-text-secondary)]">{tc.propertyLabel}</span>
                </div>
                <div className="hidden text-[11px] text-[var(--pc-text-muted)] sm:block">
                  {tc.expectedProfileNames.length} profile{tc.expectedProfileNames.length === 1 ? "" : "s"},{" "}
                  {tc.expectedGroupNames.length} group{tc.expectedGroupNames.length === 1 ? "" : "s"}
                </div>
                <button
                  type="button"
                  onClick={() => mutations.remove.mutate(tc.groupTag)}
                  disabled={mutations.remove.isPending}
                  className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-critical)]"
                  title={`Remove ${tc.groupTag} mapping`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
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

const STEPPER_LABELS = ["Credentials", "First sync", "Tag mapping", "Ready"];

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
