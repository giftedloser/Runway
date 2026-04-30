import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, PauseCircle } from "lucide-react";

import { useSetAppSetting } from "../../hooks/useSettings.js";
import type { EffectiveAppSetting } from "../../lib/types.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { useToast } from "../shared/toast.js";

export function settingByKey(settings: EffectiveAppSetting[], key: string) {
  const setting = settings.find((entry) => entry.key === key);
  if (!setting) {
    throw new Error(`Missing app setting ${key}`);
  }
  return setting;
}

export function formatSettingValue(value: EffectiveAppSetting["value"]) {
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

export function SourceIndicator({ setting }: { setting: EffectiveAppSetting }) {
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

export function SettingShell({
  setting,
  children,
  help
}: {
  setting: EffectiveAppSetting;
  children: ReactNode;
  help?: ReactNode;
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
          {help ? (
            <div className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)]">
              {help}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--pc-text-muted)]">
            <span>Default: {formatSettingValue(setting.defaultValue)}</span>
            {setting.source === "env" && setting.envVar ? (
              <span className="text-[var(--pc-warning)]">
                Edit {setting.envVar} in .env and restart to change this value.
              </span>
            ) : null}
            {setting.restartRequired ? (
              <span className="text-[var(--pc-warning)]">Restart Runway for changes to take effect.</span>
            ) : null}
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-auto">{children}</div>
      </div>
    </div>
  );
}

export function useSettingSave(onSaved?: (setting: EffectiveAppSetting) => void) {
  const setSetting = useSetAppSetting();
  const toast = useToast();

  const save = (setting: EffectiveAppSetting, value: string | number | boolean) => {
    setSetting.mutate(
      { key: setting.key, value },
      {
        onSuccess: (updated) => {
          onSaved?.(updated);
          toast.push({
            variant: "success",
            title: "Setting saved",
            description: `${updated.label} is now ${formatSettingValue(updated.value)}.`
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

  return { save, isSaving: setSetting.isPending };
}

export function ToggleControl({
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

export function NumberInputControl({
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

export function SelectControl<T extends string | number>({
  setting,
  options,
  disabled,
  onSave
}: {
  setting: EffectiveAppSetting;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onSave: (setting: EffectiveAppSetting, value: T) => void;
}) {
  const envLocked = setting.source === "env";
  return (
    <select
      className="h-8 min-w-36 rounded-[var(--pc-radius-sm)] border border-[var(--pc-input-border)] bg-[var(--pc-input-bg)] px-2.5 text-[12px] text-[var(--pc-input-text)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--pc-border-hover)] focus:border-[var(--pc-accent)] focus:shadow-[var(--pc-ring)] disabled:cursor-not-allowed disabled:opacity-70"
      value={String(setting.value)}
      disabled={disabled || envLocked}
      onChange={(event) => {
        const option = options.find((item) => String(item.value) === event.target.value);
        if (option) onSave(setting, option.value);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
