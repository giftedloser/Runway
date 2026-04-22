import { useRef, useState } from "react";
import {
  Boxes,
  Cable,
  CheckCircle2,
  Download,
  KeyRound,
  Plus,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";

import { useToast } from "../components/shared/toast.js";
import { ConfirmDialog } from "../components/shared/ConfirmDialog.js";

import { PageHeader } from "../components/layout/PageHeader.js";
import { RulesSection } from "../components/settings/RulesSection.js";
import { SystemHealthSection } from "../components/settings/SystemHealthSection.js";
import { GraphCredentialsWizard } from "../components/setup/GraphCredentialsWizard.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { useAuthStatus, useLogin, useLogout } from "../hooks/useAuth.js";
import { useSetFeatureFlag, useSettings, useTagConfigMutations } from "../hooks/useSettings.js";
import type { TagConfigRecord } from "../lib/types.js";

const REQUIRED_ENV = [
  { key: "AZURE_TENANT_ID", purpose: "Entra tenant" },
  { key: "AZURE_CLIENT_ID", purpose: "App registration" },
  { key: "AZURE_CLIENT_SECRET", purpose: "Read-only Graph access" }
] as const;

const DELEGATED_SCOPES = [
  "DeviceManagementManagedDevices.ReadWrite.All",
  "DeviceManagementManagedDevices.PrivilegedOperations.All",
  "DeviceLocalCredential.Read.All",
  "BitLockerKey.Read.All",
  "Group.ReadWrite.All",
  "DeviceManagementServiceConfig.ReadWrite.All",
  "User.Read"
];

export function SettingsPage() {
  const settings = useSettings();
  const auth = useAuthStatus();
  const login = useLogin();
  const logout = useLogout();
  const mutations = useTagConfigMutations();
  const featureFlagMutation = useSetFeatureFlag();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    groupTag: "",
    propertyLabel: "",
    expectedProfileNames: "",
    expectedGroupNames: ""
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      description: `${settings.data?.tagConfig.length ?? 0} entries written to JSON.`
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
        if (typeof obj.groupTag !== "string" || typeof obj.propertyLabel !== "string") {
          throw new Error(`Entry ${index} missing groupTag or propertyLabel.`);
        }
        return {
          groupTag: obj.groupTag,
          propertyLabel: obj.propertyLabel,
          expectedProfileNames: Array.isArray(obj.expectedProfileNames)
            ? (obj.expectedProfileNames as unknown[]).filter(
                (item): item is string => typeof item === "string"
              )
            : [],
          expectedGroupNames: Array.isArray(obj.expectedGroupNames)
            ? (obj.expectedGroupNames as unknown[]).filter(
                (item): item is string => typeof item === "string"
              )
            : []
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
        description: `${succeeded} of ${records.length} entries upserted.`
      });
    } catch (error) {
      toast.push({
        variant: "error",
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not parse the file."
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Configure how Runway connects to Microsoft Graph for your Windows Autopilot, Intune, and Entra ID tenant, and how it interprets your group tag conventions. Changes take effect on the next sync."
      />

      {/* Section 1: Graph integration */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            1. Microsoft Graph Integration
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Read-only ingestion · powers all dashboards
          </span>
        </div>

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
                    ? "Server-side credentials detected. Runway can read Autopilot, Intune, and Entra data."
                    : "Missing credentials. Runway cannot ingest live data — running in mock mode."}
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
                  <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">{env.purpose}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[var(--pc-border)] pt-5">
            <div className="mb-3 flex items-baseline gap-2">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
                {graphConfigured ? "Rotate credentials" : "Configure credentials"}
              </div>
              <span className="text-[11px] text-[var(--pc-text-muted)]">
                Writes to the server's .env — restart required
              </span>
            </div>
            <GraphCredentialsWizard onDismissRestart={() => settings.refetch()} />
          </div>
        </Card>
      </section>

      {/* Section 2: Delegated sign-in */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            2. Admin Sign-In
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Required for remote actions and LAPS
          </span>
        </div>
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={
                  isAuthed
                    ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                    : "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-tint-subtle)]"
                }
              >
                <KeyRound
                  className={
                    isAuthed
                      ? "h-4 w-4 text-[var(--pc-healthy)]"
                      : "h-4 w-4 text-[var(--pc-text-muted)]"
                  }
                />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  {isAuthed ? "Signed in" : "Not signed in"}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
                  {isAuthed && auth.data ? (
                    <>
                      <span className="text-[var(--pc-text-secondary)]">{auth.data.user}</span>
                      {auth.data.expiresAt ? (
                        <>
                          {" · token expires "}
                          {new Date(auth.data.expiresAt).toLocaleString()}
                        </>
                      ) : null}
                    </>
                  ) : (
                    "Sign in with a delegated admin account to issue remote actions and retrieve LAPS passwords."
                  )}
                </div>
                <div className="mt-3 text-[11px] text-[var(--pc-text-muted)]">
                  Required scopes:
                </div>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {DELEGATED_SCOPES.map((scope) => (
                    <li
                      key={scope}
                      className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--pc-text-secondary)]"
                    >
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="shrink-0">
              {isAuthed ? (
                <Button variant="secondary" onClick={() => logout.mutate()}>
                  Sign out
                </Button>
              ) : (
                <Button
                  onClick={() => login.mutate()}
                  disabled={login.isPending || !login.canStart}
                  title={login.blockedReason ?? undefined}
                >
                  {!login.canStart ? "Unavailable" : login.isPending ? "Opening…" : "Sign in"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Section 3: SCCM / ConfigMgr */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            3. SCCM / ConfigMgr Signal
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Optional join-picture check on device pages
          </span>
        </div>
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
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                  Reads Intune's <span className="font-mono">managementAgent</span> value and shows
                  whether a device is reporting a Configuration Manager client. This does not run
                  SCCM actions or change devices; it only adds visibility to the device-detail
                  enrollment tab and custom rule fields.
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
              title={!isAuthed ? "Sign in as an admin to change feature flags" : undefined}
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
                        description: "Device pages will reflect the setting immediately."
                      }),
                    onError: (error) =>
                      toast.push({
                        variant: "error",
                        title: "Could not update SCCM detection",
                        description:
                          error instanceof Error ? error.message : "The setting was not saved."
                      })
                  }
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

      {/* Section 4: Sources */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            4. Data Sources
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            What Runway reads from each Microsoft service
          </span>
        </div>
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-3">
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
                "Management agent"
              ]}
            />
            <SourceCard
              source="entra"
              items={["Devices", "Groups & members", "Dynamic membership rules"]}
            />
          </div>
        </Card>
      </section>

      {/* Section 5: Tag mapping */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            5. Group Tag → Profile Mapping
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Tells the engine what each Autopilot group tag should resolve to
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
              {importing ? "Importing…" : "Import JSON"}
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
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">Add mapping</div>
            {!isAuthed ? (
              <span className="ml-auto text-[11px] text-[var(--pc-warning)]">
                Admin sign-in required to change mappings.
              </span>
            ) : null}
          </div>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--pc-text-muted)]">
                Group tag
              </label>
              <Input
                placeholder="e.g. CG-LOBBY"
                value={form.groupTag}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, groupTag: event.target.value }))
                }
                onBlur={() => setTouched((p) => ({ ...p, groupTag: true }))}
                aria-invalid={touched.groupTag && !form.groupTag.trim()}
                className="w-full"
              />
              {touched.groupTag && !form.groupTag.trim() && (
                <p className="text-[11px] text-[var(--pc-critical)]">Group tag is required.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--pc-text-muted)]">
                Property label
              </label>
              <Input
                placeholder="e.g. Casino Grand Lobby"
                value={form.propertyLabel}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, propertyLabel: event.target.value }))
                }
                onBlur={() => setTouched((p) => ({ ...p, propertyLabel: true }))}
                aria-invalid={touched.propertyLabel && !form.propertyLabel.trim()}
                className="w-full"
              />
              {touched.propertyLabel && !form.propertyLabel.trim() && (
                <p className="text-[11px] text-[var(--pc-critical)]">Property label is required.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--pc-text-muted)]">
                Expected profiles (comma-separated)
              </label>
              <Input
                placeholder="LOBBY-Kiosk, LOBBY-PoS"
                value={form.expectedProfileNames}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    expectedProfileNames: event.target.value
                  }))
                }
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--pc-text-muted)]">
                Expected groups (comma-separated)
              </label>
              <Input
                placeholder="LOBBY-Devices"
                value={form.expectedGroupNames}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    expectedGroupNames: event.target.value
                  }))
                }
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              disabled={
                !isAuthed || !form.groupTag || !form.propertyLabel || mutations.create.isPending
              }
              title={!isAuthed ? "Sign in as an admin to save mappings" : undefined}
              onClick={() =>
                mutations.create.mutate(
                  {
                    groupTag: form.groupTag,
                    propertyLabel: form.propertyLabel,
                    expectedProfileNames: form.expectedProfileNames
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                    expectedGroupNames: form.expectedGroupNames
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                  },
                  {
                    onSuccess: () => {
                      setForm({
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
              <Plus className="h-3.5 w-3.5" />
              {mutations.create.isPending ? "Saving…" : "Save mapping"}
            </Button>
          </div>
        </Card>

        {settings.data.tagConfig.length === 0 ? (
          <Card className="border-dashed px-5 py-8 text-center text-[12.5px] text-[var(--pc-text-muted)]">
            No mappings yet. Without mappings, Runway cannot detect{" "}
            <span className="text-[var(--pc-text-secondary)]">tag mismatch</span> or{" "}
            <span className="text-[var(--pc-text-secondary)]">not in target group</span> conditions.
          </Card>
        ) : (
          <div className="grid gap-3 2xl:grid-cols-2">
            {settings.data.tagConfig.map((row) => (
              <Card key={row.groupTag} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
                      <div
                        className="truncate text-[14px] font-semibold text-[var(--pc-text)]"
                        title={row.groupTag}
                      >
                        {row.groupTag}
                      </div>
                    </div>
                    <div
                      className="mt-0.5 truncate text-[12px] text-[var(--pc-text-muted)]"
                      title={row.propertyLabel}
                    >
                      {row.propertyLabel}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="h-8 px-2.5"
                    disabled={!isAuthed}
                    title={!isAuthed ? "Sign in as an admin to delete mappings" : undefined}
                    onClick={() => setDeleteTarget(row.groupTag)}
                    aria-label={`Delete ${row.groupTag}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 space-y-1.5 text-[11.5px]">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[var(--pc-text-muted)]">Profiles:</span>
                    <span className="text-[var(--pc-text-secondary)]">
                      {row.expectedProfileNames.join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[var(--pc-text-muted)]">Groups:</span>
                    <span className="text-[var(--pc-text-secondary)]">
                      {row.expectedGroupNames.join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Section 6: System health & retention */}
      <SystemHealthSection />

      {/* Section 7: Custom rules */}
      <RulesSection />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete tag mapping"
        description={`Remove the mapping for group tag "${deleteTarget ?? ""}"? Devices using this tag will lose tag-mismatch and not-in-target-group detection until a new mapping is created.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) mutations.remove.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SourceCard({
  source,
  items
}: {
  source: "autopilot" | "intune" | "entra";
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
      <div className="flex items-center justify-between">
        <SourceBadge source={source} />
        <Boxes className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-1.5 text-[11.5px] text-[var(--pc-text-secondary)]"
          >
            <CheckCircle2 className="h-3 w-3 text-[var(--pc-healthy)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
