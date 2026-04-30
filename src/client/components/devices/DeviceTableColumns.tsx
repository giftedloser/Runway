import { Link } from "@tanstack/react-router";

import type { DeviceListItem } from "../../lib/types.js";
import { FlagChip } from "../shared/FlagChip.js";
import { StatusBadge } from "../shared/StatusBadge.js";

/**
 * Column registry for the device queue table. Each column declares its
 * id (used for the persisted-visibility preference), header label, an
 * optional `defaultVisible` flag, and a render function. The picker
 * surfaces every column here; the table reads `visibleColumnIds` and
 * walks the registry in declaration order so the on-screen order is
 * stable regardless of how the user toggled them.
 */

export type DeviceColumnId =
  | "device"
  | "serial"
  | "health"
  | "flags"
  | "profile"
  | "lastSeen"
  | "user"
  | "compliance"
  | "property"
  | "deploymentMode"
  | "correlation";

export interface DeviceColumnDef {
  id: DeviceColumnId;
  label: string;
  /** Whether the column is on by default for first-time users. */
  defaultVisible: boolean;
  /** Whether the column is locked on (the device name is non-removable). */
  locked?: boolean;
  /** Tailwind classes appended to the cell. */
  cellClassName?: string;
  render: (
    device: DeviceListItem,
    density: "comfortable" | "compact",
    formatTimestamp: (value: string | null | undefined) => string
  ) => React.ReactNode;
}

const dash = "\u2014";

export const DEVICE_COLUMNS: DeviceColumnDef[] = [
  {
    id: "device",
    label: "Device",
    defaultVisible: true,
    locked: true,
    cellClassName: "max-w-[260px]",
    render: (device, density) => (
      <>
        <Link
          to="/devices/$deviceKey"
          params={{ deviceKey: device.deviceKey }}
          className="block cursor-pointer truncate font-medium text-[var(--pc-text)] hover:text-[var(--pc-accent-hover)]"
          title={device.deviceName ?? device.serialNumber ?? device.deviceKey}
        >
          {device.deviceName ?? device.serialNumber ?? device.deviceKey}
        </Link>
        {density === "comfortable" && device.propertyLabel && (
          <div
            className="mt-0.5 truncate text-[11px] text-[var(--pc-text-muted)]"
            title={device.propertyLabel}
          >
            {device.propertyLabel}
          </div>
        )}
      </>
    )
  },
  {
    id: "serial",
    label: "Serial",
    defaultVisible: true,
    cellClassName: "font-mono text-[12px] text-[var(--pc-text-secondary)]",
    render: (device) => (
      <span title={device.serialNumber ?? undefined}>{device.serialNumber ?? dash}</span>
    )
  },
  {
    id: "health",
    label: "Health",
    defaultVisible: true,
    render: (device) => <StatusBadge health={device.health} />
  },
  {
    id: "flags",
    label: "Flags",
    defaultVisible: true,
    render: (device, density) => {
      const RULE_SEVERITY_STYLE: Record<string, string> = {
        critical: "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] ring-1 ring-[var(--pc-critical)]/40",
        warning: "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/40",
        info: "bg-[var(--pc-info-muted)] text-blue-200 ring-1 ring-[var(--pc-info)]/40"
      };
      const maxVisible = density === "compact" ? 1 : 2;
      const visibleFlags = device.flags.slice(0, maxVisible);
      const visibleRules = device.activeRules.slice(0, maxVisible);
      const totalShown = visibleFlags.length + visibleRules.length;
      const totalAll = device.flags.length + device.activeRules.length;
      const overflow = totalAll - totalShown;
      return (
        <div className="flex flex-wrap gap-1">
          {visibleFlags.map((flag) => (
            <FlagChip key={flag} flag={flag} />
          ))}
          {visibleRules.map((rule) => (
            <span
              key={rule.ruleId}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${RULE_SEVERITY_STYLE[rule.severity] ?? RULE_SEVERITY_STYLE.info}`}
              title={rule.ruleName}
            >
              {rule.ruleName.length > 18
                ? `${rule.ruleName.slice(0, 16)}…`
                : rule.ruleName}
            </span>
          ))}
          {overflow > 0 && (
            <span className="rounded-md bg-[var(--pc-tint-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--pc-text-muted)]">
              +{overflow}
            </span>
          )}
        </div>
      );
    }
  },
  {
    id: "profile",
    label: "Profile",
    defaultVisible: true,
    cellClassName: "max-w-[200px] truncate text-[var(--pc-text-secondary)]",
    render: (device) => (
      <span title={device.assignedProfileName ?? undefined}>
        {device.assignedProfileName ?? dash}
      </span>
    )
  },
  {
    id: "lastSeen",
    label: "Last Seen",
    defaultVisible: true,
    render: (device, density, formatTimestamp) => {
      if (!device.lastCheckinAt) {
        return <span className="text-[var(--pc-text-muted)]">Never</span>;
      }
      const ageMs = Date.now() - new Date(device.lastCheckinAt).getTime();
      const staleHours = 24;
      const isStale = ageMs > staleHours * 60 * 60 * 1000;
      const label = formatTimestamp(device.lastCheckinAt);
      if (density === "compact") {
        return (
          <span
            className={isStale ? "text-[var(--pc-warning)] font-medium" : "text-[var(--pc-text-muted)]"}
            title={isStale ? `Stale — last check-in was ${label}` : device.lastCheckinAt}
          >
            {label}
          </span>
        );
      }
      return (
        <span
          className={
            isStale
              ? "text-[var(--pc-warning)] font-medium"
              : "text-[var(--pc-text-muted)]"
          }
          title={
            isStale
              ? `Stale — last check-in was ${label}. Data may not reflect current device state.`
              : device.lastCheckinAt
          }
        >
          {label}
          {isStale && (
            <span className="ml-1 inline-flex items-center rounded bg-[var(--pc-warning-muted)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--pc-warning)]">
              stale
            </span>
          )}
        </span>
      );
    }
  },
  {
    id: "user",
    label: "Primary User",
    defaultVisible: false,
    cellClassName: "max-w-[200px] truncate text-[var(--pc-text-secondary)]",
    render: (device) => {
      const user = device.intunePrimaryUserUpn ?? device.autopilotAssignedUserUpn;
      return <span title={user ?? undefined}>{user ?? dash}</span>;
    }
  },
  {
    id: "compliance",
    label: "Compliance",
    defaultVisible: false,
    cellClassName: "text-[var(--pc-text-secondary)]",
    render: (device) => {
      if (!device.complianceState) return dash;
      const state = device.complianceState.toLowerCase();
      const tone =
        state === "compliant"
          ? "text-[var(--pc-healthy)]"
          : state === "noncompliant"
            ? "text-[var(--pc-critical)]"
            : "text-[var(--pc-text-muted)]";
      return <span className={tone}>{device.complianceState}</span>;
    }
  },
  {
    id: "property",
    label: "Property",
    defaultVisible: false,
    cellClassName: "max-w-[180px] truncate text-[var(--pc-text-secondary)]",
    render: (device) => (
      <span title={device.propertyLabel ?? undefined}>{device.propertyLabel ?? dash}</span>
    )
  },
  {
    id: "deploymentMode",
    label: "Deployment Mode",
    defaultVisible: false,
    cellClassName: "text-[var(--pc-text-secondary)]",
    render: (device) => device.deploymentMode ?? dash
  },
  {
    id: "correlation",
    label: "Correlation",
    defaultVisible: false,
    render: (device) => {
      const conf = device.matchConfidence;
      const style =
        conf === "high"
          ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)] ring-1 ring-[var(--pc-healthy)]/40"
          : conf === "medium"
            ? "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/40"
            : "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] ring-1 ring-[var(--pc-critical)]/40";
      return (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-medium capitalize ${style}`}
        >
          {conf}
        </span>
      );
    }
  }
];

export const DEFAULT_VISIBLE_COLUMNS: DeviceColumnId[] = DEVICE_COLUMNS.filter(
  (col) => col.defaultVisible
).map((col) => col.id);

export function resolveVisibleColumns(ids: DeviceColumnId[]): DeviceColumnDef[] {
  const enabled = new Set(ids);
  // Always include locked columns even if storage somehow drops them.
  return DEVICE_COLUMNS.filter((col) => col.locked || enabled.has(col.id));
}
