import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { ActionHistory } from "../components/devices/ActionHistory.js";
import { ActionsToolbar } from "../components/devices/ActionsToolbar.js";
import { AssignmentPanel } from "../components/devices/AssignmentPanel.js";
import { AssignmentPathPanel } from "../components/devices/AssignmentPathPanel.js";
import { DiagnosticPanel } from "../components/devices/DiagnosticPanel.js";
import { IdentityPanel } from "../components/devices/IdentityPanel.js";
import { LapsWidget } from "../components/devices/LapsWidget.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { useDevice } from "../hooks/useDevices.js";

const DEVICES_DEFAULT_SEARCH = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
} as const;

function SectionHeading({
  number,
  title,
  description
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--pc-accent-muted)] text-[10.5px] font-semibold text-[var(--pc-accent-hover)]">
        {number}
      </span>
      <div>
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
          {title}
        </div>
        <div className="text-[11.5px] text-[var(--pc-text-muted)]">{description}</div>
      </div>
    </div>
  );
}

export function DeviceDetailPage() {
  const { deviceKey } = useParams({ from: "/devices/$deviceKey" });
  const device = useDevice(deviceKey);

  if (device.isLoading) return <LoadingState label="Loading device…" />;
  if (device.isError || !device.data) {
    return (
      <ErrorState
        title="Could not load device"
        error={device.error}
        onRetry={() => device.refetch()}
      />
    );
  }

  const data = device.data;
  const displayName = data.summary.deviceName ?? data.summary.serialNumber ?? deviceKey;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-[var(--pc-text-muted)]">
        <Link
          to="/devices"
          search={DEVICES_DEFAULT_SEARCH}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--pc-text)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Devices
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-[var(--pc-text-secondary)]" title={displayName}>
          {displayName}
        </span>
      </nav>

      {/* Hero header */}
      <header className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pc-accent)]">
              Device Diagnostics
            </div>
            <h1
              className="mt-1 truncate text-2xl font-semibold tracking-tight text-white"
              title={displayName}
            >
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pc-text-muted)]">
              <span>
                Serial{" "}
                <span className="font-mono text-[var(--pc-text-secondary)]">
                  {data.summary.serialNumber ?? "—"}
                </span>
              </span>
              {data.summary.propertyLabel ? (
                <span>
                  Property{" "}
                  <span className="text-[var(--pc-text-secondary)]">{data.summary.propertyLabel}</span>
                </span>
              ) : null}
              <span>
                {data.diagnostics.length} active{" "}
                {data.diagnostics.length === 1 ? "issue" : "issues"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge health={data.summary.health} />
            <p
              className="max-w-md text-[12.5px] leading-relaxed text-[var(--pc-text-secondary)] lg:text-right"
              title={data.summary.diagnosis}
            >
              {data.summary.diagnosis}
            </p>
          </div>
        </div>
      </header>

      {/* Section 1: Identity — who is this device, across systems */}
      <section className="space-y-3">
        <SectionHeading
          number={1}
          title="Identity"
          description="Who this device is across Autopilot, Intune, and Entra ID"
        />
        <IdentityPanel device={data} />
      </section>

      {/* Section 2: Configuration — what it's meant to be */}
      <section className="space-y-3">
        <SectionHeading
          number={2}
          title="Expected Configuration"
          description="The provisioning chain that determines this device's intended state"
        />
        <AssignmentPathPanel path={data.assignmentPath} />
        <AssignmentPanel device={data} />
      </section>

      {/* Section 3: Diagnostics — why it's not what it should be */}
      <section className="space-y-3">
        <SectionHeading
          number={3}
          title="Diagnostics"
          description="What the state engine found and why it matters"
        />
        <DiagnosticPanel device={data} />
      </section>

      {/* Section 4: Operate — admin tools */}
      <section className="space-y-3">
        <SectionHeading
          number={4}
          title="Operate"
          description="Remote actions, secrets, and audit history (delegated sign-in required)"
        />
        <ActionsToolbar device={data} />
        <LapsWidget device={data} />
        <ActionHistory device={data} />
      </section>
    </div>
  );
}
