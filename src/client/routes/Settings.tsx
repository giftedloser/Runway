import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  Cable,
  CheckCircle2,
  DatabaseZap,
  Download,
  KeyRound,
  LockKeyhole,
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

const SETTINGS_NAV = [
  { href: "#graph", label: "Graph" },
  { href: "#access", label: "Access" },
  { href: "#admin", label: "Admin" },
  { href: "#signals", label: "Signals" },
  { href: "#sources", label: "Sources" },
  { href: "#tags", label: "Tags" },
  { href: "#health", label: "Health" },
  { href: "#rules", label: "Rules" }
] as const;

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Confirm live-data readiness, operator access, SCCM visibility, and the tag mappings Runway uses to explain join problems."
      />

      <SettingsReadinessBanner
        graphConfigured={graphConfigured}
        appAccessRequired={appAccess.required}
        adminSignedIn={isAuthed}
        sccmDetectionEnabled={sccmDetectionEnabled}
        hasTagMappings={settings.data.tagConfig.length > 0}
      />

      <SettingsJumpNav />

      {/* Section 1: Graph integration */}
      <section id="graph" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="1"
          title="Microsoft Graph Integration"
          detail="Read-only ingestion - powers dashboards and device joins"
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
                    ? "Server-side credentials detected. Runway can read Autopilot, Intune, Entra, and ConfigMgr management-agent signals."
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

      {/* Section 2: App access gate */}
      <section id="access" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="2"
          title="App Access"
          detail="Optional Entra login before the workspace opens"
        />
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={
                  appAccess.required
                    ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                    : "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-tint-subtle)]"
                }
              >
                <LockKeyhole
                  className={
                    appAccess.required
                      ? "h-4 w-4 text-[var(--pc-healthy)]"
                      : "h-4 w-4 text-[var(--pc-text-muted)]"
                  }
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                    {appAccess.required ? "Entra gate active" : "Entra gate not enforced"}
                  </div>
                  <span
                    className={
                      appAccess.required
                        ? "rounded-md bg-[var(--pc-healthy-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-healthy)]"
                        : "rounded-md bg-[var(--pc-tint-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-text-muted)]"
                    }
                  >
                    APP_ACCESS_MODE={appAccess.mode}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                  Set <span className="font-mono">APP_ACCESS_MODE=entra</span> to require a
                  tenant sign-in before Runway loads. It only becomes enforceable after Graph
                  credentials are configured, so first-run setup remains reachable.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
                    <div className="font-mono text-[11px] text-[var(--pc-text-secondary)]">
                      APP_ACCESS_ALLOWED_USERS
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">
                      {appAccess.allowedUsersConfigured
                        ? "Allow-list configured."
                        : "Blank: any user in the configured tenant can enter."}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
                    <div className="font-mono text-[11px] text-[var(--pc-text-secondary)]">
                      Recovery path
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">
                      Set <span className="font-mono">APP_ACCESS_MODE=disabled</span> in .env and
                      restart if an allow-list ever locks you out.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Section 3: Delegated sign-in */}
      <section id="admin" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="3"
          title="Admin Sign-In"
          detail="Required for remote actions, LAPS, BitLocker, and settings changes"
        />
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
                          {" - token expires "}
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

      {/* Section 4: SCCM / ConfigMgr */}
      <section id="signals" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="4"
          title="SCCM / ConfigMgr Signal"
          detail="Optional join-picture check on device pages"
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

      {/* Section 5: Sources */}
      <section id="sources" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="5"
          title="Data Sources"
          detail="What Runway reads from each Microsoft service"
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
                "Management agent"
              ]}
            />
            <SourceCard
              source="entra"
              items={["Devices", "Groups & members", "Dynamic membership rules"]}
            />
            <SourceCard
              source="sccm"
              items={[
                "ConfigMgr client signal",
                "Co-management indicator",
                "Derived from Intune managementAgent"
              ]}
            />
          </div>
        </Card>
      </section>

      {/* Section 6: Tag mapping */}
      <section id="tags" className="scroll-mt-6 space-y-3">
        <SettingsSectionHeader
          index="6"
          title="Group Tag -> Profile Mapping"
          detail="Tells the engine what each Autopilot group tag should resolve to"
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
            <Tag className="mx-auto mb-2 h-5 w-5 text-[var(--pc-accent)]" />
            <div className="font-semibold text-[var(--pc-text-secondary)]">No mappings yet</div>
            <div className="mx-auto mt-1 max-w-xl leading-5">
              Without mappings, Runway cannot detect{" "}
              <span className="text-[var(--pc-text-secondary)]">tag mismatch</span> or{" "}
              <span className="text-[var(--pc-text-secondary)]">not in target group</span>{" "}
              conditions.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 2xl:grid-cols-2">
            {settings.data.tagConfig.map((row) => (
              <Card
                key={row.groupTag}
                className="pc-interactive-lift p-4 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)]"
              >
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

      {/* Section 7: System health & retention */}
      <SystemHealthSection />

      {/* Section 8: Custom rules */}
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

function SettingsJumpNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-2 z-10 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-glass)] p-1 shadow-[var(--pc-shadow-card)] backdrop-blur supports-[backdrop-filter]:bg-[var(--pc-surface-glass)]"
    >
      <div className="flex gap-1 overflow-x-auto">
        {SETTINGS_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-[var(--pc-radius-sm)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--pc-text-muted)] transition-[background-color,color] duration-150 hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SettingsSectionHeader({
  index,
  title,
  detail,
  actions
}: {
  index: string;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-semibold text-[var(--pc-accent)]">
            {index.padStart(2, "0")}
          </span>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            {title}
          </h2>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--pc-text-muted)]">{detail}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

function SettingsReadinessBanner({
  graphConfigured,
  appAccessRequired,
  adminSignedIn,
  sccmDetectionEnabled,
  hasTagMappings
}: {
  graphConfigured: boolean;
  appAccessRequired: boolean;
  adminSignedIn: boolean;
  sccmDetectionEnabled: boolean;
  hasTagMappings: boolean;
}) {
  const blockers = [
    !graphConfigured ? "Graph credentials missing" : null,
    !hasTagMappings ? "No tag mappings" : null,
    !adminSignedIn ? "Admin sign-in needed for changes/actions" : null
  ].filter(Boolean);
  const ready = graphConfigured && hasTagMappings;

  const items = [
    {
      label: "Live data",
      value: graphConfigured ? "Ready" : "Mock mode",
      good: graphConfigured,
      detail: graphConfigured ? "Graph credentials detected" : "Add Graph credentials before tenant testing"
    },
    {
      label: "Technician access",
      value: appAccessRequired ? "Entra gate on" : "Gate off",
      good: appAccessRequired,
      detail: appAccessRequired ? "Users sign in before fleet data loads" : "Enable after setup if techs will use it"
    },
    {
      label: "Admin session",
      value: adminSignedIn ? "Signed in" : "Not signed in",
      good: adminSignedIn,
      detail: adminSignedIn ? "Privileged settings/actions available" : "Required for mappings, feature flags, and actions"
    },
    {
      label: "SCCM signal",
      value: sccmDetectionEnabled ? "On" : "Off",
      good: sccmDetectionEnabled,
      detail: sccmDetectionEnabled ? "Device pages show ConfigMgr signal" : "Optional visibility check is disabled"
    },
    {
      label: "Tag mappings",
      value: hasTagMappings ? "Configured" : "Missing",
      good: hasTagMappings,
      detail: hasTagMappings ? "Runway can detect tag/profile drift" : "Needed for target-group and tag mismatch flags"
    }
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={
              ready
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-warning-muted)]"
            }
          >
            {ready ? (
              <DatabaseZap className="h-4 w-4 text-[var(--pc-healthy)]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[var(--pc-warning)]" />
            )}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              {ready ? "Live testing readiness looks good" : "Setup still has readiness gaps"}
            </div>
            <div className="mt-0.5 text-[12px] leading-5 text-[var(--pc-text-muted)]">
              {ready
                ? "Graph ingestion and tag interpretation are configured. Review access and optional signals before pilot use."
                : blockers.join(", ")}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-[var(--pc-border)] md:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-[var(--pc-surface)] px-4 py-3 transition-colors duration-150 hover:bg-[var(--pc-surface-raised)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                {item.label}
              </div>
              {item.good ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--pc-warning)]" />
              )}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--pc-text)]">{item.value}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-[var(--pc-text-muted)]">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SourceCard({
  source,
  items
}: {
  source: "autopilot" | "intune" | "entra" | "sccm";
  items: string[];
}) {
  return (
    <div className="pc-interactive-lift rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)]">
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
