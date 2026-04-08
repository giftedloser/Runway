import { useRef, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Download,
  KeyRound,
  Plus,
  Tag,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";

import { useToast } from "../components/shared/toast.js";

import { PageHeader } from "../components/layout/PageHeader.js";
import { RulesSection } from "../components/settings/RulesSection.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { useAuthStatus, useLogin, useLogout } from "../hooks/useAuth.js";
import { useSettings, useTagConfigMutations } from "../hooks/useSettings.js";
import type { TagConfigRecord } from "../lib/types.js";

const REQUIRED_ENV = [
  { key: "AZURE_TENANT_ID", purpose: "Entra tenant" },
  { key: "AZURE_CLIENT_ID", purpose: "App registration" },
  { key: "AZURE_CLIENT_SECRET", purpose: "Read-only Graph access" }
] as const;

const DELEGATED_SCOPES = [
  "DeviceManagementManagedDevices.ReadWrite.All",
  "DeviceManagementManagedDevices.PrivilegedOperations.All",
  "DeviceLocalCredential.Read.All"
];

export function SettingsPage() {
  const settings = useSettings();
  const auth = useAuthStatus();
  const login = useLogin();
  const logout = useLogout();
  const mutations = useTagConfigMutations();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    groupTag: "",
    propertyLabel: "",
    expectedProfileNames: "",
    expectedGroupNames: ""
  });

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

  const exportTagConfig = () => {
    const payload = JSON.stringify(settings.data?.tagConfig ?? [], null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pilotcheck-tag-config-${new Date().toISOString().slice(0, 10)}.json`;
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
        description="Configure how PilotCheck connects to Microsoft Graph for your Windows Autopilot, Intune, and Entra ID tenant, and how it interprets your group tag conventions. Changes take effect on the next sync."
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
          <div className="flex items-start justify-between gap-4">
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
                  <div className="text-[13px] font-semibold text-white">
                    Application credentials
                  </div>
                  <SourceBadge source="graph" />
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
                  {graphConfigured
                    ? "Server-side credentials detected. PilotCheck can read Autopilot, Intune, and Entra data."
                    : "Missing credentials. PilotCheck cannot ingest live data — running in mock mode."}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
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

          {!graphConfigured ? (
            <div className="mt-4 rounded-lg border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-100">
              Set the variables above in the server's environment (or a <code>.env</code> file at
              the repo root), then restart the host process. PilotCheck will pick them up on the next
              start.
            </div>
          ) : null}
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={
                  isAuthed
                    ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                    : "flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]"
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
                <div className="text-[13px] font-semibold text-white">
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
                <Button onClick={() => login.mutate()} disabled={login.isPending}>
                  {login.isPending ? "Opening…" : "Sign in"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Section 3: Sources */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            3. Data Sources
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            What PilotCheck reads from each Microsoft service
          </span>
        </div>
        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
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
                "Primary user"
              ]}
            />
            <SourceCard
              source="entra"
              items={["Devices", "Groups & members", "Dynamic membership rules"]}
            />
          </div>
        </Card>
      </section>

      {/* Section 4: Tag mapping */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            4. Group Tag → Profile Mapping
          </h2>
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Tells the engine what each Autopilot group tag should resolve to
          </span>
          <div className="ml-auto flex items-center gap-2">
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
              disabled={importing}
              title="Import tag mappings from JSON (upserts by group tag)"
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
            <div className="text-[13px] font-semibold text-white">Add mapping</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
                Group tag
              </label>
              <Input
                placeholder="e.g. CG-LOBBY"
                value={form.groupTag}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, groupTag: event.target.value }))
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
                value={form.propertyLabel}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, propertyLabel: event.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
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
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
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
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              disabled={!form.groupTag || !form.propertyLabel || mutations.create.isPending}
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
                    onSuccess: () =>
                      setForm({
                        groupTag: "",
                        propertyLabel: "",
                        expectedProfileNames: "",
                        expectedGroupNames: ""
                      })
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
            No mappings yet. Without mappings, PilotCheck cannot detect{" "}
            <span className="text-[var(--pc-text-secondary)]">tag mismatch</span> or{" "}
            <span className="text-[var(--pc-text-secondary)]">not in target group</span> conditions.
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {settings.data.tagConfig.map((row) => (
              <Card key={row.groupTag} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
                      <div
                        className="truncate text-[14px] font-semibold text-white"
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
                    onClick={() => mutations.remove.mutate(row.groupTag)}
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

      {/* Section 5: Custom rules */}
      <RulesSection />
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
