import { LayoutPanelTop, MonitorCog } from "lucide-react";

import type { EffectiveAppSetting } from "../../lib/types.js";
import { useTheme, type Theme } from "../../hooks/useTheme.js";
import { Card } from "../ui/card.js";
import { SettingsSectionHeader } from "./SettingsShared.js";
import {
  SelectControl,
  SettingShell,
  ToggleControl,
  settingByKey,
  useSettingSave
} from "./AppSettingControls.js";

const THEME_OPTIONS: Array<{ value: "light" | "dark" | "system"; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];
const DATE_FORMAT_OPTIONS = [
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" }
] as const;
const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour" }
] as const;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200].map((value) => ({
  value,
  label: `${value} rows`
}));
const LANDING_OPTIONS = [
  { value: "devices", label: "Devices" },
  { value: "tags", label: "Tags" },
  { value: "provisioning", label: "Provisioning Builder" }
] as const;

function appThemeToLocalTheme(value: string): Theme {
  if (value === "light") return "canopy-light";
  if (value === "dark") return "canopy-dark";
  return "system";
}

export function DisplayBehaviorSection({
  appSettings,
  adminSignedIn
}: {
  appSettings: EffectiveAppSetting[];
  adminSignedIn: boolean;
}) {
  const [, , resolvedTheme, setTheme] = useTheme();
  const { save, isSaving } = useSettingSave((updated) => {
    if (updated.key === "display.theme" && typeof updated.value === "string") {
      setTheme(appThemeToLocalTheme(updated.value));
    }
  });
  const saveDisabled = !adminSignedIn || isSaving;

  return (
    <section id="display-behavior" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="3"
        title="Display & Behavior"
        detail="Theme, timestamp style, table defaults, and launch behavior"
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)]">
              <MonitorCog className="h-4 w-4 text-[var(--pc-accent-hover)]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                Operator preferences
              </div>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                Changes apply immediately in the current window. Theme is currently applied through the browser shell and saved as a Runway app setting.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingShell
              setting={settingByKey(appSettings, "display.theme")}
              help={`Current applied theme: ${resolvedTheme === "canopy-dark" ? "Canopy Dark" : "Canopy Light"}.`}
            >
              <SelectControl
                setting={settingByKey(appSettings, "display.theme")}
                options={THEME_OPTIONS}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "display.dateFormat")}>
              <SelectControl
                setting={settingByKey(appSettings, "display.dateFormat")}
                options={DATE_FORMAT_OPTIONS}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "display.timeFormat")}>
              <SelectControl
                setting={settingByKey(appSettings, "display.timeFormat")}
                options={TIME_FORMAT_OPTIONS}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <SettingShell setting={settingByKey(appSettings, "display.tablePageSize")}>
              <SelectControl
                setting={settingByKey(appSettings, "display.tablePageSize")}
                options={PAGE_SIZE_OPTIONS}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "display.defaultLandingScreen")}>
              <SelectControl
                setting={settingByKey(appSettings, "display.defaultLandingScreen")}
                options={LANDING_OPTIONS}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
            <SettingShell setting={settingByKey(appSettings, "behavior.confirmDestructiveActions")}>
              <ToggleControl
                setting={settingByKey(appSettings, "behavior.confirmDestructiveActions")}
                disabled={saveDisabled}
                onSave={save}
              />
            </SettingShell>
          </div>

          <div className="flex items-start gap-2 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
            <LayoutPanelTop className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-accent)]" />
            <div>
              Table page size is used when a table route does not already have a page-size value in the URL.
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
