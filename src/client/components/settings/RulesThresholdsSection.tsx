import { Gauge } from "lucide-react";

import type { EffectiveAppSetting } from "../../lib/types.js";
import { Card } from "../ui/card.js";
import { SettingsSectionHeader } from "./SettingsShared.js";
import {
  NumberInputControl,
  SettingShell,
  settingByKey,
  useSettingSave
} from "./AppSettingControls.js";

export function RulesThresholdsSection({
  appSettings,
  adminSignedIn
}: {
  appSettings: EffectiveAppSetting[];
  adminSignedIn: boolean;
}) {
  const { save, isSaving } = useSettingSave();
  const saveDisabled = !adminSignedIn || isSaving;

  return (
    <section id="rule-thresholds" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="2"
        title="Rules & Thresholds"
        detail="Time windows used by built-in bad-state detection"
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)]">
              <Gauge className="h-4 w-4 text-[var(--pc-accent-hover)]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                Built-in rule thresholds
              </div>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                These values tune when existing rules flag a device. The settings table is key/value based so future rule thresholds can be added without another schema change.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 lg:grid-cols-2">
          <SettingShell
            setting={settingByKey(appSettings, "rules.profileAssignedNotEnrolledHours")}
            help="Identifies Autopilot records where a deployment profile has been assigned, but the device still has not enrolled. Raise this in slow staging environments; lower it when you want assignment failures to surface faster."
          >
            <NumberInputControl
              setting={settingByKey(appSettings, "rules.profileAssignedNotEnrolledHours")}
              min={0}
              max={168}
              suffix="hours"
              disabled={saveDisabled}
              onSave={save}
            />
          </SettingShell>
          <SettingShell
            setting={settingByKey(appSettings, "rules.provisioningStalledHours")}
            help="Identifies devices that started provisioning but have stopped making useful progress. Tune this for enrollment windows, network conditions, and technician workflow speed."
          >
            <NumberInputControl
              setting={settingByKey(appSettings, "rules.provisioningStalledHours")}
              min={0}
              max={168}
              suffix="hours"
              disabled={saveDisabled}
              onSave={save}
            />
          </SettingShell>
        </div>
      </Card>
    </section>
  );
}
