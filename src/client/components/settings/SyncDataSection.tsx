import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Database, PauseCircle, PlayCircle } from "lucide-react";

import type { EffectiveAppSetting } from "../../lib/types.js";
import { useSetAppSetting } from "../../hooks/useSettings.js";
import { useToast } from "../shared/toast.js";
import { Card } from "../ui/card.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";
import { SettingsSectionHeader } from "./SettingsShared.js";

const SYNC_INTERVAL_OPTIONS = [5, 15, 30, 60] as const;

type SettingMap = Map<string, EffectiveAppSetting>;

function settingByKey(settings: EffectiveAppSetting[], key: string) {
  const setting = settings.find((entry) => entry.key === key);
  if (!setting) {
    throw new Error(`Missing app setting ${key}`);
  }
  return setting;
}

function formatValue(value: EffectiveAppSetting["value"]) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (value == null) return "none";
  return String(value);
}

function sourceMeta(setting: EffectiveAppSetting) {
  if (setting.source === "db") {
    return {
      label: "Saved in Runway",
      className: "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
    };
  }
  if (setting.source === "env") {
    return {
      label: "Set by environment",
      className: "border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
    };
  }
  return {
    label: "Default",
    className: "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-muted)]"
  };
}

function SourceIndicator({ setting }: { setting: EffectiveAppSetting }) {
  const meta = sourceMeta(setting);
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
      title={
        setting.source === "env" && setting.envVar
          ? `${setting.envVar} is set in the environment. Edit .env and restart Runway to change it.`
          : undefined
      }
    >
      {meta.label}
    </span>
  );
}

function SettingShell({
  setting,
  children
}: {
  setting: EffectiveAppSetting;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">{setting.label}</div>
            <SourceIndicator setting={setting} />
          </div>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
            {setting.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--pc-text-muted)]">
            <span>Default: {formatValue(setting.defaultValue)}</span>
            {setting.source === "env" && setting.envVar ? (
              <span className="text-[var(--pc-warning)]">
                Edit {setting.envVar} in .env and restart to change this value.
              </span>
            ) : null}
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-auto">{children}</div>
      </div>
    </div>
  );
}

function ToggleControl({
  setting,
  disabled,
  onSave
}: {
  setting: EffectiveAppSetting;
  disabled?: boolean;
  onSave: (setting: EffectiveAppSetting, value: boolean) => void;
}) {
  const enabled = setting.value === true;
  const envLocked = setting.source === "env";
  return (
    <Button
      type="button"
      variant={enabled ? "default" : "secondary"}
      className="h-8 min-w-24 px-2.5 text-[11.5px]"
      disabled={disabled || envLocked}
      onClick={() => onSave(setting, !enabled)}
      aria-pressed={enabled}
    >
      {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
      {enabled ? "On" : "Off"}
    </Button>
  );
}

function NumberInputControl({
  setting,
  min,
  max,
  step,
  suffix,
  disabled,
  onSave
}: {
  setting: EffectiveAppSetting;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  disabled?: boolean;
  onSave: (setting: EffectiveAppSetting, value: number) => void;
}) {
  const [draft, setDraft] = useState(String(setting.value));
  const [error, setError] = useState<string | null>(null);
  const envLocked = setting.source === "env";

  useEffect(() => {
    setDraft(String(setting.value));
    setError(null);
  }, [setting.value]);

  const commit = () => {
    if (envLocked || disabled) return;
    const next = Number(draft);
    if (!Number.isFinite(next) || next < min || next > max) {
      setError(`Enter a value from ${min} to ${max}.`);
      return;
    }
    setError(null);
    if (next !== setting.value) onSave(setting, next);
  };

  return (
    <div className="space-y-1 sm:w-40">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step ?? 1}
          value={draft}
          disabled={disabled || envLocked}
          aria-invalid={Boolean(error)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-24"
        />
        <span className="text-[11px] text-[var(--pc-text-muted)]">{suffix}</span>
      </div>
      {error ? <div className="text-[11px] text-[var(--pc-critical)]">{error}</div> : null}
    </div>
  );
}

function SelectControl({
  setting,
  options,
  disabled,
  onSave
}: {
  setting: EffectiveAppSetting;
  options: readonly number[];
  disabled?: boolean;
  onSave: (setting: EffectiveAppSetting, value: number) => void;
}) {
  const envLocked = setting.source === "env";
  return (
    <select
      className="h-8 min-w-36 rounded-[var(--pc-radius-sm)] border border-[var(--pc-input-border)] bg-[var(--pc-input-bg)] px-2.5 text-[12px] text-[var(--pc-input-text)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--pc-border-hover)] focus:border-[var(--pc-accent)] focus:shadow-[var(--pc-ring)] disabled:cursor-not-allowed disabled:opacity-70"
      value={Number(setting.value)}
      disabled={disabled || envLocked}
      onChange={(event) => onSave(setting, Number(event.target.value))}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option} minutes
        </option>
      ))}
    </select>
  );
}

export function SyncDataSection({
  appSettings,
  adminSignedIn
}: {
  appSettings: EffectiveAppSetting[];
  adminSignedIn: boolean;
}) {
  const settings = useMemo<SettingMap>(
    () => new Map(appSettings.map((setting) => [setting.key, setting])),
    [appSettings]
  );
  const setSetting = useSetAppSetting();
  const toast = useToast();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const save = (setting: EffectiveAppSetting, value: string | number | boolean) => {
    setSetting.mutate(
      { key: setting.key, value },
      {
        onSuccess: (updated) => {
          toast.push({
            variant: "success",
            title: "Setting saved",
            description: `${updated.label} is now ${formatValue(updated.value)}.`
          });
        },
        onError: (error) => {
          toast.push({
            variant: "error",
            title: "Setting not saved",
            description: error instanceof Error ? error.message : "The value was rejected."
          });
        }
      }
    );
  };

  const syncPaused = settings.get("sync.paused")?.value === true;
  const manualOnly = settings.get("sync.manualOnly")?.value === true;
  const saveDisabled = !adminSignedIn || setSetting.isPending;

  return (
    <section id="sync-data" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="1"
        title="Sync & Data"
        detail="Cadence, launch behavior, and retention windows"
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={
                  syncPaused
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-warning-muted)]"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                }
              >
                {syncPaused ? (
                  <PauseCircle className="h-4 w-4 text-[var(--pc-warning)]" />
                ) : (
                  <PlayCircle className="h-4 w-4 text-[var(--pc-healthy)]" />
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  {syncPaused ? "Background sync paused" : manualOnly ? "Manual sync only" : "Background sync active"}
                </div>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                  Effective value order is Runway setting, then legacy environment override, then code default.
                  Environment-sourced values are shown read-only here; edit .env and restart Runway to change them.
                </p>
              </div>
            </div>
            {!adminSignedIn ? (
              <div className="rounded-md border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3 py-2 text-[11.5px] text-[var(--pc-warning)]">
                Admin sign-in required to change settings.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <SettingShell setting={settingByKey(appSettings, "sync.intervalMinutes")}>
              <SelectControl
                setting={settingByKey(appSettings, "sync.intervalMinutes")}
                options={SYNC_INTERVAL_OPTIONS}
              disabled={saveDisabled}
              onSave={save}
            />
          </SettingShell>

          <div className="grid gap-3 lg:grid-cols-3">
            <SettingShell setting={settingByKey(appSettings, "sync.onLaunch")}>
              <ToggleControl
                setting={settingByKey(appSettings, "sync.onLaunch")}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "sync.manualOnly")}>
              <ToggleControl
                setting={settingByKey(appSettings, "sync.manualOnly")}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "sync.paused")}>
              <ToggleControl
                setting={settingByKey(appSettings, "sync.paused")}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <SettingShell setting={settingByKey(appSettings, "retention.deviceHistoryDays")}>
              <NumberInputControl
                setting={settingByKey(appSettings, "retention.deviceHistoryDays")}
                min={0}
                max={3650}
                suffix="days"
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "retention.actionLogDays")}>
              <NumberInputControl
                setting={settingByKey(appSettings, "retention.actionLogDays")}
                min={0}
                max={3650}
                suffix="days"
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "retention.syncLogDays")}>
              <NumberInputControl
                setting={settingByKey(appSettings, "retention.syncLogDays")}
                min={0}
                max={3650}
                suffix="days"
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
          </div>

          <details
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[12px] font-semibold text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]">
              <Database className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
              Advanced retention
              <span className="ml-auto text-[11px] font-normal text-[var(--pc-text-muted)]">
                {advancedOpen ? "Hide" : "Show"}
              </span>
            </summary>
            <div className="border-t border-[var(--pc-border)] p-4">
              <SettingShell setting={settingByKey(appSettings, "retention.sweepIntervalHours")}>
                <NumberInputControl
                  setting={settingByKey(appSettings, "retention.sweepIntervalHours")}
                  min={0.5}
                  max={168}
                  step={0.5}
                  suffix="hours"
                  disabled={saveDisabled}
                  onSave={save}
                />
              </SettingShell>
            </div>
          </details>

          {syncPaused ? (
            <div className="flex items-start gap-2 rounded-[var(--pc-radius)] border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-4 py-3 text-[12px] text-[var(--pc-warning)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Sync is paused. Launch sync and scheduled background sync will stay off until Pause sync is turned off.
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-accent)]" />
            <div>
              Scheduled sync checks these values live. Changing sync interval, manual-only, or pause takes effect without restarting Runway.
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
