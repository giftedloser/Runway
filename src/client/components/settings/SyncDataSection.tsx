import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Database, PauseCircle, PlayCircle } from "lucide-react";

import type { EffectiveAppSetting } from "../../lib/types.js";
import { Card } from "../ui/card.js";
import { SettingsSectionHeader } from "./SettingsShared.js";
import {
  NumberInputControl,
  SelectControl,
  SettingShell,
  ToggleControl,
  settingByKey,
  useSettingSave
} from "./AppSettingControls.js";

const SYNC_INTERVAL_OPTIONS = [5, 15, 30, 60].map((value) => ({
  value,
  label: `${value} minutes`
}));

type SettingMap = Map<string, EffectiveAppSetting>;

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
  const { save, isSaving } = useSettingSave();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const syncPaused = settings.get("sync.paused")?.value === true;
  const manualOnly = settings.get("sync.manualOnly")?.value === true;
  const saveDisabled = !adminSignedIn || isSaving;

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
