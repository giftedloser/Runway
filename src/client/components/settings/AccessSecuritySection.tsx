import { Link } from "@tanstack/react-router";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { useAuthStatus, useLogin, useLogout } from "../../hooks/useAuth.js";
import type { AppAccessSettings, EffectiveAppSetting } from "../../lib/types.js";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { SettingsSectionHeader } from "./SettingsShared.js";
import {
  NumberInputControl,
  SettingShell,
  settingByKey,
  useSettingSave
} from "./AppSettingControls.js";

const DELEGATED_SCOPES = [
  "DeviceManagementManagedDevices.ReadWrite.All",
  "DeviceManagementManagedDevices.PrivilegedOperations.All",
  "DeviceLocalCredential.Read.All",
  "BitLockerKey.Read.All",
  "Group.ReadWrite.All",
  "DeviceManagementServiceConfig.ReadWrite.All",
  "User.Read"
];

export function AccessSecuritySection({
  appSettings,
  appAccess,
  adminSignedIn
}: {
  appSettings: EffectiveAppSetting[];
  appAccess: AppAccessSettings;
  adminSignedIn: boolean;
}) {
  const auth = useAuthStatus();
  const login = useLogin();
  const logout = useLogout();
  const { save, isSaving } = useSettingSave();
  const saveDisabled = !adminSignedIn || isSaving;

  return (
    <section id="access-security" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="6"
        title="Access & Security"
        detail="Environment-controlled access gate, admin session, and idle timeout"
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={
                appAccess.required
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-tint-subtle)]"
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
            <div>
              <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                {appAccess.required ? "Entra gate active" : "Entra gate not enforced"}
              </div>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                App access mode and allowed users are controlled by .env and require a restart. Runway does not allow disabling Entra access from the UI.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <ReadOnlyEnvCard
              label="APP_ACCESS_MODE"
              value={appAccess.mode}
              detail="Edit .env and restart Runway to change the app access mode."
            />
            <ReadOnlyEnvCard
              label="APP_ACCESS_ALLOWED_USERS"
              value={
                appAccess.allowedUsersConfigured
                  ? `${appAccess.allowedUsersCount} users configured. Edit .env to change.`
                  : "Any tenant user"
              }
              detail={
                appAccess.allowedUsersConfigured
                  ? "Only listed users can pass the app access gate."
                  : "Blank allow-list means any signed-in user in the tenant can enter."
              }
            />
          </div>

          <SettingShell setting={settingByKey(appSettings, "security.sessionTimeoutMinutes")}>
            <NumberInputControl
              setting={settingByKey(appSettings, "security.sessionTimeoutMinutes")}
              min={0}
              max={1440}
              suffix="minutes"
              disabled={saveDisabled}
              onSave={save}
            />
          </SettingShell>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
              <div className="flex items-start gap-3">
                <div
                  className={
                    auth.data?.authenticated
                      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-tint-subtle)]"
                  }
                >
                  <KeyRound
                    className={
                      auth.data?.authenticated
                        ? "h-4 w-4 text-[var(--pc-healthy)]"
                        : "h-4 w-4 text-[var(--pc-text-muted)]"
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                    {auth.data?.authenticated ? "Admin session active" : "Admin session inactive"}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--pc-text-muted)]">
                    {auth.data?.authenticated ? auth.data.user : "Sign in with delegated Graph permissions for admin actions."}
                  </div>
                  <div className="mt-3 text-[11px] text-[var(--pc-text-muted)]">Required scopes:</div>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {DELEGATED_SCOPES.map((scope) => (
                      <li
                        key={scope}
                        className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--pc-text-secondary)]"
                      >
                        {scope}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0">
                  {auth.data?.authenticated ? (
                    <Button variant="secondary" onClick={() => logout.mutate()}>
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      onClick={() => login.mutate()}
                      disabled={login.isPending || !login.canStart}
                      title={login.blockedReason ?? undefined}
                    >
                      {!login.canStart ? "Unavailable" : login.isPending ? "Opening..." : "Sign in"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Link
              to="/actions"
              className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4 transition-[border-color,background-color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            >
              <ShieldCheck className="h-4 w-4 text-[var(--pc-accent)]" />
              <div className="mt-3 text-[13px] font-semibold text-[var(--pc-text)]">Audit log</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                View recent admin and remediation actions in Action Audit.
              </p>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}

function ReadOnlyEnvCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-mono text-[11px] text-[var(--pc-text-secondary)]">{label}</div>
        <span className="inline-flex items-center rounded-md border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-warning)]">
          Set by environment
        </span>
      </div>
      <div className="mt-2 break-words text-[13px] font-semibold text-[var(--pc-text)]">{value}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">{detail}</p>
    </div>
  );
}
