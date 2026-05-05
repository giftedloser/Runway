import { useState } from "react";
import {
  AlertCircle,
  Eraser,
  LogOut,
  Power,
  RefreshCw,
  RotateCcw,
  Shield,
  Terminal,
  Trash2,
  Type,
  UserRound
} from "lucide-react";

import type { DeviceDetailResponse, RemoteActionType } from "../../lib/types.js";
import { useRemoteAction } from "../../hooks/useActions.js";
import { useAuthStatus, useLogin } from "../../hooks/useAuth.js";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { Input } from "../ui/input.js";
import { ConfirmDialog } from "../shared/ConfirmDialog.js";
import { EntityPicker, type EntityPickerSelection } from "../shared/EntityPicker.js";
import { useToast } from "../shared/toast.js";

interface ActionSpec {
  type: RemoteActionType;
  label: string;
  icon: typeof RefreshCw;
  description: string;
  destructive?: boolean;
  requireTyped?: boolean;
  needsInput?: "newName" | "primaryUser";
}

const ACTIONS: ActionSpec[] = [
  {
    type: "sync",
    label: "Sync Now",
    icon: RefreshCw,
    description: "Force an Intune check-in for this device. Safe, non-destructive."
  },
  {
    type: "reboot",
    label: "Reboot",
    icon: Power,
    description: "Send a reboot command to the device. The user will be disconnected."
  },
  {
    type: "rename",
    label: "Rename",
    icon: Type,
    description: "Rename the device in Intune. Requires an admin account with write permissions.",
    needsInput: "newName"
  },
  {
    type: "rotate-laps",
    label: "Rotate LAPS",
    icon: RotateCcw,
    description: "Trigger a LAPS password rotation. The new password will be available after next check-in."
  },
  {
    type: "change-primary-user",
    label: "Change Primary User",
    icon: UserRound,
    description:
      "Update the Intune primary user reference. Search Entra users, select the intended account, then confirm the assignment.",
    needsInput: "primaryUser"
  },
  {
    type: "autopilot-reset",
    label: "Autopilot Reset",
    icon: Shield,
    description:
      "Reset the device back to OOBE while keeping it enrolled. User data will be wiped.",
    destructive: true,
    requireTyped: true
  },
  {
    type: "retire",
    label: "Retire",
    icon: LogOut,
    description:
      "Remove the device from Intune management and remove company data. Device remains usable.",
    destructive: true,
    requireTyped: true
  },
  {
    type: "wipe",
    label: "Factory Wipe",
    icon: Eraser,
    description:
      "Perform a full factory reset. ALL data will be erased and the device will be unenrolled.",
    destructive: true,
    requireTyped: true
  },
  {
    type: "delete-intune",
    label: "Delete from Intune",
    icon: Trash2,
    description: "Permanently delete this device's Intune managed device record. This cannot be undone.",
    destructive: true,
    requireTyped: true
  },
  {
    type: "delete-autopilot",
    label: "Delete from Autopilot",
    icon: Trash2,
    description: "Remove this device's Windows Autopilot registration. The hardware hash will need to be re-imported to re-register. Cannot be undone.",
    destructive: true,
    requireTyped: true
  }
];

const INTUNE_BACKED_ACTIONS = new Set<RemoteActionType>([
  "sync",
  "reboot",
  "rename",
  "rotate-laps",
  "autopilot-reset",
  "retire",
  "wipe",
  "change-primary-user",
  "delete-intune"
]);

function actionAvailability(
  spec: ActionSpec,
  device: DeviceDetailResponse,
  isAuthed: boolean
): { disabled: boolean; reason?: string } {
  if (INTUNE_BACKED_ACTIONS.has(spec.type) && !device.identity.intuneId) {
    return { disabled: true, reason: "This device has no Intune enrollment." };
  }
  if (spec.type === "delete-autopilot" && !device.identity.autopilotId) {
    return { disabled: true, reason: "This device has no Autopilot registration." };
  }
  if (!isAuthed) {
    return { disabled: true, reason: "Admin sign-in required." };
  }
  return { disabled: false };
}

export function ActionsToolbar({ device }: { device: DeviceDetailResponse }) {
  const auth = useAuthStatus();
  const login = useLogin();
  const action = useRemoteAction();
  const toast = useToast();

  const [pending, setPending] = useState<ActionSpec | null>(null);
  const [typedConfirm, setTypedConfirm] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedPrimaryUser, setSelectedPrimaryUser] =
    useState<EntityPickerSelection | null>(null);

  const isAuthed = auth.data?.authenticated === true;
  const deviceName = device.summary.deviceName ?? device.summary.serialNumber ?? "this device";

  // Build the typed-confirmation token from the strongest available
  // identifier. If a record is so thin that none of these are present
  // (rare — usually an orphaned Autopilot or Entra-only ghost), fall
  // back to null and refuse to render the destructive flow rather than
  // accepting a generic "CONFIRM" string that wouldn't tie the typed
  // text to *this* device.
  const confirmationToken =
    device.summary.serialNumber ??
    device.summary.deviceName ??
    device.identity.intuneId ??
    device.identity.autopilotId ??
    null;

  const handleRequest = (spec: ActionSpec) => {
    if (spec.requireTyped && !confirmationToken) {
      toast.push({
        variant: "error",
        title: `${spec.label} unavailable`,
        description:
          "This device is missing a serial number, device name, Intune ID, and Autopilot ID. Cannot confirm a destructive action against an unidentifiable record."
      });
      return;
    }
    setTypedConfirm("");
    setNewName(device.summary.deviceName ?? "");
    setSelectedPrimaryUser(null);
    setPending(spec);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const spec = pending;
    try {
      const body =
        spec.needsInput === "newName"
          ? { deviceName: newName.trim() }
          : spec.needsInput === "primaryUser"
          ? selectedPrimaryUser
            ? { userId: selectedPrimaryUser.id }
            : undefined
          : undefined;
      const result = await action.mutateAsync({
        deviceKey: device.summary.deviceKey,
        action: spec.type,
        body
      });
      toast.push({
        variant: result.success ? "success" : "error",
        title: `${spec.label} ${result.success ? "dispatched" : "failed"}`,
        description:
          result.message ??
          (result.success
            ? "Action sent to Intune. Check Action History for the timeline."
            : "Action failed. Check Action History for details.")
      });
      setPending(null);
    } catch (error) {
      toast.push({
        variant: "error",
        title: `${spec.label} failed`,
        description:
          error instanceof Error
            ? `${error.message} Check Action History for details.`
            : "Action failed. Check Action History for details."
      });
      setPending(null);
    }
  };

  const inputBlocked =
    pending?.needsInput === "newName"
      ? !newName.trim()
      : pending?.needsInput === "primaryUser"
      ? !selectedPrimaryUser
      : false;

  const actionGroups: Array<{ title: string; description: string; actions: ActionSpec[] }> = [
    {
      title: "Recommended action",
      description: "Low-risk refresh for the current device record.",
      actions: ACTIONS.filter((spec) => spec.type === "sync")
    },
    {
      title: "Common safe actions",
      description: "Operational actions that do not remove enrollment.",
      actions: ACTIONS.filter((spec) => ["reboot", "rename", "rotate-laps"].includes(spec.type))
    },
    {
      title: "Account and user",
      description: "Ownership changes tied to the Intune user relationship.",
      actions: ACTIONS.filter((spec) => spec.type === "change-primary-user")
    },
    {
      title: "Advanced destructive actions",
      description: "Reset, retire, wipe, or delete records. Typed confirmation required.",
      actions: ACTIONS.filter((spec) => spec.destructive)
    }
  ];

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--pc-accent)]" />
            <span className="text-[13px] font-semibold text-[var(--pc-text)]">Remote Actions</span>
          </div>
          {isAuthed ? (
            <div className="text-[11px] text-[var(--pc-text-muted)]">
              Signed in as <span className="text-[var(--pc-text-secondary)]">{auth.data?.user}</span>
            </div>
          ) : null}
        </div>

        {!isAuthed ? (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
              <div>
                <div className="text-[12.5px] font-medium text-[var(--pc-text)]">Admin sign-in required</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--pc-text-muted)]">
                  Remote actions and LAPS retrieval require a delegated Microsoft account with the
                  correct Intune permissions.
                </div>
              </div>
            </div>
            <Button
              onClick={() => login.mutate()}
              disabled={login.isPending || !login.canStart}
              title={login.blockedReason ?? undefined}
              className="shrink-0"
            >
              {!login.canStart ? "Unavailable" : login.isPending ? "Opening…" : "Sign in"}
            </Button>
          </div>
        ) : null}

        <div className="space-y-4">
          {actionGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="text-[12px] font-semibold text-[var(--pc-text-secondary)]">
                  {group.title}
                </div>
                <div className="text-[11px] text-[var(--pc-text-muted)]">
                  {group.description}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {group.actions.map((spec) => {
                  const Icon = spec.icon;
                  const availability = actionAvailability(spec, device, isAuthed);
                  return (
                    <button
                      key={spec.type}
                      type="button"
                      onClick={() => handleRequest(spec)}
                      disabled={availability.disabled}
                      title={availability.reason}
                      className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-medium transition-[border-color,background-color,color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        availability.disabled
                          ? "cursor-not-allowed border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-muted)] opacity-60 focus-visible:outline-[var(--pc-accent)]"
                          : spec.destructive
                          ? "border-[var(--pc-border)] border-l-2 border-l-[var(--pc-critical)]/40 bg-[var(--pc-surface-raised)] text-[var(--pc-text)] hover:border-[var(--pc-critical)]/40 hover:border-l-[var(--pc-critical)] hover:bg-[var(--pc-critical-muted)] hover:text-[var(--pc-critical)] focus-visible:outline-[var(--pc-critical)] active:translate-y-px"
                          : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text)] hover:border-[var(--pc-accent)]/40 hover:bg-[var(--pc-accent-muted)] hover:text-[var(--pc-accent-hover)] focus-visible:outline-[var(--pc-accent)] active:translate-y-px"
                      }`}
                      aria-label={spec.destructive ? `${spec.label} — destructive` : spec.label}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          spec.destructive && !availability.disabled
                            ? "text-[var(--pc-critical)]/60 group-hover:text-[var(--pc-critical)]"
                            : ""
                        }`}
                      />
                      <span>{spec.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${pending.label} — ${deviceName}` : ""}
        description={pending?.description ?? ""}
        destructive={pending?.destructive}
        requireTyped={pending?.requireTyped ? confirmationToken ?? undefined : undefined}
        typedValue={typedConfirm}
        onTypedChange={setTypedConfirm}
        confirmLabel={pending?.label ?? "Confirm"}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        isLoading={action.isPending}
        confirmDisabled={inputBlocked}
      >
        {pending?.needsInput ? (
          <div className="space-y-1.5">
            {pending.needsInput === "newName" ? (
              <>
                <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                  New device name
                </label>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. CG-LOBBY-001"
                  className="mt-1.5 w-full"
                  autoFocus
                />
              </>
            ) : (
              <>
                {device.summary.intunePrimaryUserUpn ? (
                  <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2 text-[11.5px] text-[var(--pc-text-muted)]">
                    Current Intune primary user:{" "}
                    <span className="font-medium text-[var(--pc-text-secondary)]">
                      {device.summary.intunePrimaryUserUpn}
                    </span>
                  </div>
                ) : null}
                <EntityPicker
                  id="change-primary-user-picker"
                  label="Primary user"
                  value={selectedPrimaryUser}
                  onSelect={setSelectedPrimaryUser}
                  onClear={() => setSelectedPrimaryUser(null)}
                  autoFocus
                />
                {selectedPrimaryUser ? (
                  <div className="rounded-lg border border-[var(--pc-accent)]/25 bg-[var(--pc-accent-muted)] px-3 py-2 text-[11.5px] text-[var(--pc-text-secondary)]">
                    Confirm assignment to{" "}
                    <span className="font-semibold text-[var(--pc-text)]">
                      {selectedPrimaryUser.label}
                    </span>
                    {selectedPrimaryUser.userPrincipalName ? (
                      <span> ({selectedPrimaryUser.userPrincipalName})</span>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
