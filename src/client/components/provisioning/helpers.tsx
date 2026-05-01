import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  XCircle,
} from "lucide-react";

import { Card } from "../ui/card.js";
import { cn } from "../../lib/utils.js";

export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "healthy" | "warning";
}) {
  const toneClass =
    tone === "healthy"
      ? "border-[var(--pc-healthy)]/25 bg-[var(--pc-healthy-muted)]/55"
      : tone === "warning"
        ? "border-[var(--pc-warning)]/25 bg-[var(--pc-warning-muted)]/55"
        : "border-[var(--pc-border)] bg-[var(--pc-surface)]";

  return (
    <Card className={cn("p-4", toneClass)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--pc-text)]">
        {value}
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)]">
        {hint}
      </div>
    </Card>
  );
}

export function SummaryBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[15px] font-semibold text-[var(--pc-text)]">
        {value}
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--pc-text-secondary)]">
        {hint}
      </div>
    </div>
  );
}

export function ChipList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-[11.5px] text-[var(--pc-text-secondary)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-1 text-[11px] text-[var(--pc-text)]"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CountPill({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-full border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-secondary)]">
      {value} {label}
    </span>
  );
}

export function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function SelectionBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        active
          ? "bg-[var(--pc-accent)] text-[var(--pc-text)]"
          : "bg-[var(--pc-tint-hover)] text-[var(--pc-text-muted)]",
      )}
    >
      {active ? "Selected" : "Pick"}
    </span>
  );
}

export function EmptyPanel({
  message,
  guidance,
}: {
  message: string;
  guidance?: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <div className="text-[13px] font-semibold text-[var(--pc-text)]">
        {message}
      </div>
      {guidance ? (
        <div className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
          {guidance}
        </div>
      ) : null}
    </div>
  );
}

export function SelectionSummary({
  icon,
  label,
  value,
  helper,
  detailRows = [],
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  detailRows?: Array<{ label: string; value: string }>;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
          <span className="text-[var(--pc-accent)]">{icon}</span>
          {label}
        </div>
        {onCopy ? (
          <IconButton label={`Copy ${label.toLowerCase()}`} onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
        ) : null}
      </div>
      <div className="mt-2 text-[14px] font-semibold text-[var(--pc-text)]">
        {value}
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)]">
        {helper}
      </div>
      {detailRows.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2.5">
          {detailRows.map((row) => (
            <div
              key={`${label}-${row.label}`}
              className="flex items-start justify-between gap-3 text-[11px]"
            >
              <span className="text-[var(--pc-text-muted)]">{row.label}</span>
              <span className="max-w-[60%] text-right text-[var(--pc-text-secondary)]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StatusRow({
  label,
  status,
  helper,
  tone = "default",
}: {
  label: string;
  status: boolean;
  helper: string;
  tone?: "default" | "info";
}) {
  const activeClass =
    tone === "info"
      ? "border-[var(--pc-info)]/30 bg-[var(--pc-info-muted)]/55"
      : "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)]/55";

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        status
          ? activeClass
          : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-[var(--pc-text)]">
          {label}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            status
              ? tone === "info"
                ? "bg-[var(--pc-info)]/18 text-[var(--pc-info)]"
                : "bg-[var(--pc-healthy)]/18 text-[var(--pc-healthy)]"
              : "bg-[var(--pc-tint-hover)] text-[var(--pc-text-muted)]",
          )}
        >
          {status ? "Ready" : "Pending"}
        </span>
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)]">
        {helper}
      </div>
    </div>
  );
}

export function CompareRow({
  label,
  state,
  emptyLabel,
}: {
  label: string;
  state: boolean | null;
  emptyLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--pc-border)] py-2 last:border-b-0 last:pb-0">
      <div>
        <div className="text-[11.5px] font-medium text-[var(--pc-text)]">
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--pc-text-secondary)]">
          {state === null
            ? emptyLabel
            : state
              ? "Matches the stored expected configuration."
              : "Does not match the stored expected configuration."}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          state === null
            ? "bg-[var(--pc-tint-hover)] text-[var(--pc-text-muted)]"
            : state
              ? "bg-[var(--pc-healthy)]/18 text-[var(--pc-healthy)]"
              : "bg-[var(--pc-warning)]/18 text-[var(--pc-warning)]",
        )}
      >
        {state === null ? "Open" : state ? "Match" : "Review"}
      </span>
    </div>
  );
}

export function ResultBanner({ valid }: { valid: boolean }) {
  return valid ? (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] px-4 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-healthy)]" />
      <div>
        <div className="text-[12px] font-semibold text-[var(--pc-healthy)]">
          Provisioning chain validated
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--pc-healthy)]/85">
          The current response did not return blocking validation errors.
        </div>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] px-4 py-3">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-critical)]" />
      <div>
        <div className="text-[12px] font-semibold text-[var(--pc-critical)]">
          Provisioning chain requires attention
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--pc-critical)]/85">
          The selected chain returned one or more blocking errors.
        </div>
      </div>
    </div>
  );
}

export function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "critical" | "warning";
}) {
  const icon =
    tone === "critical" ? (
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--pc-critical)]" />
    ) : (
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--pc-warning)]" />
    );

  const classes =
    tone === "critical"
      ? "border-[var(--pc-critical)]/20 bg-[var(--pc-critical-muted)]/55"
      : "border-[var(--pc-warning)]/20 bg-[var(--pc-warning-muted)]/55";

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {title}
      </div>
      {items.map((item, index) => (
        <div
          key={`${title}-${index}`}
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5",
            classes,
          )}
        >
          {icon}
          <div className="text-[11.5px] leading-relaxed text-[var(--pc-text)]">
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatMembershipType(value: string) {
  if (value === "DynamicMembership") return "Dynamic Membership";
  if (value === "Assigned") return "Assigned";
  return value;
}

export function formatDeploymentMode(value: string | null) {
  if (!value) return "Unknown";
  if (value === "userDriven") return "User-driven";
  if (value === "selfDeploying") return "Self-deploying";
  if (value === "preProvisioning") return "Pre-provisioning";
  return value;
}
