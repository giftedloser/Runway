import { useState } from "react";
import { AlertTriangle, Copy, FileText, RefreshCw } from "lucide-react";

import {
  useRecentLogs,
  type LogEntry,
  type LogLevel
} from "../../hooks/useRecentLogs.js";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { useToast } from "../shared/toast.js";
import { SettingsSectionHeader } from "./SettingsShared.js";

const LEVELS: ReadonlyArray<{ value: LogLevel | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "info", label: "Info+" },
  { value: "warn", label: "Warn+" },
  { value: "error", label: "Error+" }
];

const LEVEL_TONE: Record<LogLevel, string> = {
  trace: "text-[var(--pc-text-muted)]",
  debug: "text-[var(--pc-text-muted)]",
  info: "text-[var(--pc-text-secondary)]",
  warn: "text-[var(--pc-warning)]",
  error: "text-[var(--pc-critical)]",
  fatal: "text-[var(--pc-critical)]"
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour12: false });
}

function summarizeFields(entry: LogEntry): string {
  // Strip the headline fields pino always sets so the "extras" panel only
  // shows the bits an operator can act on (err, ruleId, syncId, etc.).
  const omit = new Set(["time", "level", "msg", "pid", "hostname", "v"]);
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (!omit.has(k)) extras[k] = v;
  }
  return Object.keys(extras).length === 0 ? "" : JSON.stringify(extras, null, 2);
}

export function LogViewerSection() {
  const [level, setLevel] = useState<LogLevel | "all">("warn");
  const [expanded, setExpanded] = useState<number | null>(null);
  const logs = useRecentLogs(level, 500);
  const toast = useToast();

  const onCopy = async (entry: LogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      toast.push({ variant: "success", title: "Log entry copied" });
    } catch {
      toast.push({
        variant: "error",
        title: "Copy failed",
        description: "Clipboard access was denied."
      });
    }
  };

  return (
    <section id="logs" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="12"
        title="Recent Logs"
        detail="Last 500 runtime entries from the in-memory ring buffer"
        actions={
          <div className="flex items-center gap-1">
            {LEVELS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLevel(opt.value)}
                className={
                  "h-7 rounded-md border px-2 text-[11px] " +
                  (level === opt.value
                    ? "border-[var(--pc-accent)] bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
                    : "border-[var(--pc-border)] bg-[var(--pc-surface)] text-[var(--pc-text-muted)] hover:text-[var(--pc-text)]")
                }
              >
                {opt.label}
              </button>
            ))}
            <Button
              variant="secondary"
              className="h-7 px-2 text-[11px]"
              onClick={() => void logs.refetch()}
              disabled={logs.isFetching}
              title="Refresh logs"
            >
              <RefreshCw
                className={
                  logs.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
                }
              />
            </Button>
          </div>
        }
      />

      <Card className="p-0 overflow-hidden">
        {logs.isLoading ? (
          <div className="p-5 text-[12px] text-[var(--pc-text-muted)]">
            Loading logs…
          </div>
        ) : logs.isError ? (
          <div className="flex items-start gap-2 p-5 text-[12px] text-[var(--pc-critical)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Could not read /api/health/logs.</div>
              <div className="mt-0.5 text-[var(--pc-text-muted)]">
                {logs.error instanceof Error
                  ? logs.error.message
                  : "Sign in as admin to view server logs."}
              </div>
            </div>
          </div>
        ) : !logs.data || logs.data.length === 0 ? (
          <div className="flex items-center gap-2 p-5 text-[12px] text-[var(--pc-text-muted)]">
            <FileText className="h-4 w-4" />
            No log entries at <span className="font-mono">{level}</span> or higher.
          </div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-[var(--pc-border)] overflow-y-auto font-mono text-[11.5px]">
            {logs.data.map((entry, index) => {
              const tone = LEVEL_TONE[entry.level] ?? "";
              const isOpen = expanded === index;
              const extras = isOpen ? summarizeFields(entry) : "";
              return (
                <li key={index} className="px-3 py-2 hover:bg-[var(--pc-surface-overlay)]">
                  <div className="flex items-start gap-2">
                    <span className="w-[68px] shrink-0 text-[var(--pc-text-muted)]">
                      {formatTime(entry.time)}
                    </span>
                    <span
                      className={`w-[44px] shrink-0 uppercase ${tone}`}
                      title={entry.level}
                    >
                      {entry.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : index)}
                      className="flex-1 text-left text-[var(--pc-text)] hover:text-[var(--pc-accent)]"
                    >
                      {entry.msg || "(empty message)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCopy(entry)}
                      className="shrink-0 rounded p-1 text-[var(--pc-text-muted)] hover:bg-[var(--pc-surface)] hover:text-[var(--pc-text)]"
                      title="Copy entry as JSON"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isOpen && extras ? (
                    <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-[var(--pc-surface)] p-2 text-[10.5px] text-[var(--pc-text-secondary)]">
                      {extras}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
