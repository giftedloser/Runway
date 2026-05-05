import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Cable,
  CheckCircle2,
  Download,
  Tag,
  ToggleLeft,
  ToggleRight,
  Upload,
  XCircle,
} from "lucide-react";

import { useToast } from "../components/shared/toast.js";

import { PageHeader } from "../components/layout/PageHeader.js";
import { LogViewerSection } from "../components/settings/LogViewerSection.js";
import { RulesSection } from "../components/settings/RulesSection.js";
import { RulesThresholdsSection } from "../components/settings/RulesThresholdsSection.js";
import { SyncDataSection } from "../components/settings/SyncDataSection.js";
import { DisplayBehaviorSection } from "../components/settings/DisplayBehaviorSection.js";
import { AccessSecuritySection } from "../components/settings/AccessSecuritySection.js";
import { AboutSection } from "../components/settings/AboutSection.js";
import { SystemHealthSection } from "../components/settings/SystemHealthSection.js";
import { GraphCredentialsWizard } from "../components/setup/GraphCredentialsWizard.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useAuthStatus } from "../hooks/useAuth.js";
import {
  useSetFeatureFlag,
  useSettings,
  useTagConfigMutations,
} from "../hooks/useSettings.js";
import type { TagConfigRecord } from "../lib/types.js";
import {
  SettingsJumpNav,
  SettingsReadinessBanner,
  SettingsSectionHeader,
  SourceCard,
} from "../components/settings/SettingsShared.js";

const REQUIRED_ENV = [
  { key: "AZURE_TENANT_ID", purpose: "Entra tenant" },
  { key: "AZURE_CLIENT_ID", purpose: "App registration" },
  { key: "AZURE_CLIENT_SECRET", purpose: "Read-only Graph access" },
] as const;

export function SettingsPage() {
  const settings = useSettings();
  const auth = useAuthStatus();
  const mutations = useTagConfigMutations();
  const featureFlagMutation = useSetFeatureFlag();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  if (settings.isLoading) return <LoadingState label="Loading settings…" />;
  if (settings.isError || !settings.data) {
    return (
      <ErrorState
        title="Could not load settings"
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
    );
  }

  const graphConfigured = settings.data.graph.configured;
  const missing = settings.data.graph.missing;
  const isAuthed = auth.data?.authenticated === true;
  const appAccess = settings.data.appAccess;
  const sccmDetectionEnabled = settings.data.featureFlags.sccm_detection;

  const exportTagConfig = () => {
    const payload = JSON.stringify(settings.data?.tagConfig ?? [], null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `runway-tag-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.push({
      variant: "success",
      title: "Exported tag mappings",
      description: `${settings.data?.tagConfig.length ?? 0} entries written to JSON.`,
    });
  };

  const importTagConfig = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array of tag mappings.");
      }
      const records = parsed.map((entry, index): TagConfigRecord => {
        if (typeof entry !== "object" || entry === null) {
          throw new Error(`Entry ${index} is not an object.`);
        }
        const obj = entry as Record<string, unknown>;
        if (
          typeof obj.groupTag !== "string" ||
          typeof obj.propertyLabel !== "string"
        ) {
          throw new Error(`Entry ${index} missing groupTag or propertyLabel.`);
        }
        return {
          groupTag: obj.groupTag,
          propertyLabel: obj.propertyLabel,
          expectedProfileNames: Array.isArray(obj.expectedProfileNames)
            ? (obj.expectedProfileNames as unknown[]).filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          expectedGroupNames: Array.isArray(obj.expectedGroupNames)
            ? (obj.expectedGroupNames as unknown[]).filter(
                (item): item is string => typeof item === "string",
              )
            : [],
        };
      });
      let succeeded = 0;
      for (const record of records) {
        await mutations.create.mutateAsync(record);
        succeeded += 1;
      }
      toast.push({
        variant: "success",
        title: "Tag mappings imported",
        description: `${succeeded} of ${records.length} entries upserted.`,
      });
    } catch (error) {
      toast.push({
        variant: "error",
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Could not parse the file.",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Connect Graph, manage tag mappings, tune detection rules, and review system health."
      />

      <SettingsReadinessBanner
        graphConfigured={graphConfigured}
        appAccessRequired={appAccess.required}
        adminSignedIn={isAuthed}
        sccmDetectionEnabled={sccmDetectionEnabled}
        hasTagMappings={settings.data.tagConfig.length > 0}
      />

      <SettingsJumpNav />

      <DisplayBehaviorSection
        appSettings={settings.data.appSettings}
        adminSignedIn={isAuthed}
      />

      {/* Section 2: Graph integration */}
      <section id="graph" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="2"
          title="Graph Integration"
          detail="Read-only ingestion for Start and joins"
        />

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              {graphConfigured ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--pc-healthy)]" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-critical-muted)]">
                  <XCircle className="h-4 w-4 text-[var(--pc-critical)]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                    Application credentials
                  </div>
                  <SourceBadge source="graph" />
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
                  {graphConfigured
                    ? "Credentials detected. Live Graph ingestion is available."
                    : "Missing credentials. Live data ingestion is unavailable."}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-3">
            {REQUIRED_ENV.map((env) => {
              const present = !missing.includes(env.key);
              return (
                <div
                  key={env.key}
                  className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[var(--pc-text-secondary)]">
                      {env.key}
                    </span>
                    {present ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">
                    {env.purpose}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[var(--pc-border)] pt-5">
            <div className="mb-3 flex items-baseline gap-2">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
                {graphConfigured
                  ? "Rotate credentials"
                  : "Configure credentials"}
              </div>
              <span className="text-[11px] text-[var(--pc-text-muted)]">
                Writes to the server's .env — restart required
              </span>
            </div>
            <GraphCredentialsWizard
              onDismissRestart={() => settings.refetch()}
            />
          </div>
        </Card>
      </section>

      <SyncDataSection
        appSettings={settings.data.appSettings}
        adminSignedIn={isAuthed}
      />

      {/* Section 4: Tag mapping */}
      <section id="tags" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="4"
          title="Tag Mapping"
          detail="Bulk import/export only; edit individual mappings in Tags"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importTagConfig(file);
                }}
              />
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-[11.5px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || !isAuthed}
                title={
                  isAuthed
                    ? "Import tag mappings from JSON (upserts by group tag)"
                    : "Admin sign-in required to import tag mappings"
                }
              >
                <Upload className="h-3.5 w-3.5" />
                {importing ? "Importing..." : "Import JSON"}
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-[11.5px]"
                onClick={exportTagConfig}
                disabled={(settings.data?.tagConfig.length ?? 0) === 0}
                title="Download all tag mappings as JSON"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </Button>
            </div>
          }
        />

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)]">
                <Tag className="h-4 w-4 text-[var(--pc-accent-hover)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  Import / export tag mappings
                </div>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                  Use JSON import/export to back up mappings or hand them off between tenants. Edit individual mappings in the Tags view.
                </p>
              </div>
            </div>
            <Link
              to="/tags"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--pc-radius-sm)] border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 text-[12px] font-medium text-[var(--pc-text-body)] transition-[background-color,border-color,color,transform] hover:-translate-y-px hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            >
              Manage individual mappings in Tags view →
            </Link>
          </div>
        </Card>
      </section>

      <RulesThresholdsSection
        appSettings={settings.data.appSettings}
        adminSignedIn={isAuthed}
      />

      {/* Section 6: Custom rules (moved adjacent to Rules & Thresholds) */}
      <RulesSection />

      <AccessSecuritySection
        appSettings={settings.data.appSettings}
        appAccess={appAccess}
        adminSignedIn={isAuthed}
      />

      {/* Section 8: SCCM / ConfigMgr */}
      <section id="signals" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="8"
          title="SCCM / ConfigMgr Signal"
          detail="Optional ConfigMgr visibility on device pages"
        />
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={
                  sccmDetectionEnabled
                    ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                    : "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-tint-subtle)]"
                }
              >
                <Cable
                  className={
                    sccmDetectionEnabled
                      ? "h-4 w-4 text-[var(--pc-healthy)]"
                      : "h-4 w-4 text-[var(--pc-text-muted)]"
                  }
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                    ConfigMgr client detection
                  </div>
                  <span
                    className={
                      sccmDetectionEnabled
                        ? "rounded-md bg-[var(--pc-healthy-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-healthy)]"
                        : "rounded-md bg-[var(--pc-tint-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-text-muted)]"
                    }
                  >
                    {sccmDetectionEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-[12px] text-[var(--pc-text-muted)]">
                  Reads Intune <span className="font-mono">managementAgent</span>{" "}
                  for device-detail and rule visibility only.
                </p>
                {!isAuthed ? (
                  <p className="mt-2 text-[11px] text-[var(--pc-warning)]">
                    Admin sign-in is required to change this setting.
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              variant={sccmDetectionEnabled ? "secondary" : "default"}
              disabled={!isAuthed || featureFlagMutation.isPending}
              title={
                !isAuthed
                  ? "Sign in as an admin to change feature flags"
                  : undefined
              }
              onClick={() =>
                featureFlagMutation.mutate(
                  { key: "sccm_detection", enabled: !sccmDetectionEnabled },
                  {
                    onSuccess: () =>
                      toast.push({
                        variant: "success",
                        title: !sccmDetectionEnabled
                          ? "SCCM detection enabled"
                          : "SCCM detection disabled",
                        description:
                          "Device pages will reflect the setting immediately.",
                      }),
                    onError: (error) =>
                      toast.push({
                        variant: "error",
                        title: "Could not update SCCM detection",
                        description:
                          error instanceof Error
                            ? error.message
                            : "The setting was not saved.",
                      }),
                  },
                )
              }
            >
              {sccmDetectionEnabled ? (
                <ToggleRight className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5" />
              )}
              {featureFlagMutation.isPending
                ? "Saving…"
                : sccmDetectionEnabled
                  ? "Disable"
                  : "Enable"}
            </Button>
          </div>
        </Card>
      </section>

      {/* Section 9: Sources */}
      <section id="sources" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="9"
          title="Data Sources"
          detail="Synced Microsoft service data"
        />
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SourceCard
              source="autopilot"
              items={["Hardware records", "Group tags", "Assigned user"]}
            />
            <SourceCard
              source="intune"
              items={[
                "Managed devices",
                "Deployment profiles",
                "Compliance state",
                "Primary user",
                "Management agent",
              ]}
            />
            <SourceCard
              source="entra"
              items={[
                "Devices",
                "Groups & members",
                "Dynamic membership rules",
              ]}
            />
            <SourceCard
              source="sccm"
              items={[
                "ConfigMgr client presence",
                "Derived from Intune managementAgent",
                "No site-server connection",
              ]}
            />
          </div>
        </Card>
      </section>

      {/* Section 10: System health & retention */}
      <SystemHealthSection />

      {/* Section 11: Recent logs */}
      <LogViewerSection />

      <AboutSection about={settings.data.about} />

    </div>
  );
}
