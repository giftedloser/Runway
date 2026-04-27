import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Copy,
  ExternalLink,
  Stethoscope,
  Terminal
} from "lucide-react";
import { useState } from "react";

import type { DeviceDetailResponse, FlagExplanation } from "../../lib/types.js";
import { useToast } from "../shared/toast.js";
import { Card } from "../ui/card.js";
import {
  getPlaybook,
  type PlaybookContext,
  type PlaybookStep
} from "./diagnostic-playbooks.js";

export function DiagnosticPanel({ device }: { device: DeviceDetailResponse }) {
  const playbookContext: PlaybookContext = {
    serialNumber: device.summary.serialNumber,
    intuneId: device.identity.intuneId,
    autopilotId: device.identity.autopilotId,
    entraId: device.identity.entraId,
    deviceName: device.summary.deviceName
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--pc-text)]">Diagnostics</span>
      </div>

      {/* Primary diagnosis */}
      <div
        className={`mb-5 flex items-start gap-3 rounded-lg p-4 ${
          device.summary.health === "critical"
            ? "bg-[var(--pc-critical-muted)]"
            : device.summary.health === "healthy"
              ? "bg-[var(--pc-healthy-muted)]"
              : device.summary.health === "info"
                ? "bg-[var(--pc-info-muted)]"
                : "bg-[var(--pc-warning-muted)]"
        }`}
      >
        {device.summary.health === "healthy" ? (
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-healthy)]" />
        ) : (
          <AlertCircle
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              device.summary.health === "critical"
                ? "text-[var(--pc-critical)]"
                : device.summary.health === "info"
                  ? "text-[var(--pc-info)]"
                  : "text-[var(--pc-warning)]"
            }`}
          />
        )}
        <div
          className={`text-[13px] leading-relaxed ${
            device.summary.health === "critical"
              ? "text-[var(--pc-critical)]"
              : device.summary.health === "healthy"
                ? "text-[var(--pc-healthy)]"
                : device.summary.health === "info"
                  ? "text-[var(--pc-info)]"
                  : "text-[var(--pc-warning)]"
          }`}
        >
          {device.summary.diagnosis}
        </div>
      </div>

      {/* Detailed diagnostics */}
      {device.diagnostics.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] px-4 py-3">
          <CheckCircle className="h-4 w-4 text-[var(--pc-healthy)]" />
          <div>
            <div className="text-[13px] font-medium text-[var(--pc-healthy)]">No issues detected</div>
            <div className="text-[11.5px] text-[var(--pc-healthy)]/70">
              The state engine found no problems with this device's identity, targeting, enrollment, or drift posture.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {device.diagnostics.map((diagnostic) => (
            <DiagnosticCard
              key={diagnostic.code}
              diagnostic={diagnostic}
              playbook={getPlaybook(diagnostic.code, playbookContext)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function DiagnosticCard({
  diagnostic,
  playbook
}: {
  diagnostic: FlagExplanation;
  playbook: PlaybookStep[];
}) {
  return (
    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            diagnostic.severity === "critical"
              ? "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
              : diagnostic.severity === "warning"
                ? "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
                : "bg-[var(--pc-info-muted)] text-[var(--pc-info)]"
          }`}
        >
          {diagnostic.severity}
        </span>
        <span className="text-[13px] font-semibold text-[var(--pc-text)]">{diagnostic.title}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--pc-text-secondary)]">
        {diagnostic.summary}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
        {diagnostic.whyItMatters}
      </p>

      {diagnostic.caveat ? (
        <div className="mt-2.5 flex items-start gap-2 rounded-md border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--pc-warning)]" />
          <p className="text-[11.5px] leading-relaxed text-[var(--pc-warning)]">
            {diagnostic.caveat}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-medium text-[var(--pc-text-muted)]">Checks</div>
          <ul className="space-y-1.5">
            {diagnostic.checks.map((check) => (
              <li
                key={check}
                className="flex items-start gap-2 text-[12px] text-[var(--pc-text-secondary)]"
              >
                <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--pc-text-muted)]" />
                {check}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-medium text-[var(--pc-text-muted)]">Raw Data</div>
          <div className="space-y-1">
            {diagnostic.rawData.map((item) => (
              <div
                key={item}
                className="font-mono text-[11px] leading-relaxed text-[var(--pc-text-muted)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {playbook.length > 0 && (
        <div className="mt-4 rounded-md border border-[var(--pc-accent)]/25 bg-[var(--pc-accent-muted)]/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-accent-hover)]">
            <Terminal className="h-3 w-3" />
            Playbook
          </div>
          <ul className="space-y-1.5">
            {playbook.map((step, idx) => (
              <PlaybookRow key={`${step.type}-${idx}`} step={step} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlaybookRow({ step }: { step: PlaybookStep }) {
  const toast = useToast();
  const isLink = step.type === "portal" || step.type === "doc";
  const [lastAction, setLastAction] = useState<"opened" | "copied" | null>(null);
  const Icon =
    step.type === "powershell"
      ? Terminal
      : step.type === "graph"
        ? Copy
        : step.type === "doc"
          ? BookOpen
          : ExternalLink;

  const markAction = (action: "opened" | "copied") => {
    setLastAction(action);
    window.setTimeout(() => setLastAction(null), 2_400);
  };

  const writeClipboard = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(step.payload);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = step.payload;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("Fallback clipboard copy failed.");
    }
  };

  const copyPayload = async (successTitle = "Copied to clipboard") => {
    try {
      await writeClipboard();
      markAction("copied");
      toast.push({
        variant: "success",
        title: successTitle,
        description: step.label,
        durationMs: 1800
      });
      return true;
    } catch {
      toast.push({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access denied."
      });
      return false;
    }
  };

  const onOpen = async () => {
    // window.open(..., "noopener,noreferrer") returns null per spec even on
    // success, so we can't trust its return value. Use an anchor click,
    // which keeps rel="noopener noreferrer" security and reliably tells us
    // whether we dispatched the open.
    let dispatched = false;
    try {
      const anchor = document.createElement("a");
      anchor.href = step.payload;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      dispatched = true;
    } catch {
      dispatched = false;
    }

    if (dispatched) {
      markAction("opened");
      toast.push({
        variant: "info",
        title: "Opened playbook link",
        description: step.label,
        durationMs: 1500
      });
      return;
    }

    await copyPayload("Link copied instead");
  };

  return (
    <li className="flex items-center gap-2 text-[12px]">
      <Icon className="h-3 w-3 shrink-0 text-[var(--pc-accent)]" />
      <span className="min-w-0 flex-1 truncate text-[var(--pc-text-secondary)]" title={step.payload}>
        {step.label}
      </span>
      {isLink ? (
        <div className="flex shrink-0 items-center gap-1">
          {lastAction ? (
            <span className="rounded bg-[var(--pc-healthy-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-healthy)]">
              {lastAction === "opened" ? "Opened" : "Copied"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onOpen}
            className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--pc-accent-hover)] transition-colors hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            title={step.payload}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => void copyPayload("Link copied")}
            className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            title={step.payload}
          >
            Copy
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {lastAction ? (
            <span className="rounded bg-[var(--pc-healthy-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-healthy)]">
              Copied
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void copyPayload()}
            className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            title={step.payload}
          >
            Copy Command
          </button>
        </div>
      )}
    </li>
  );
}
