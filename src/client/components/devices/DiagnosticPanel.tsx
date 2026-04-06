import { AlertCircle, CheckCircle, Stethoscope } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";

export function DiagnosticPanel({ device }: { device: DeviceDetailResponse }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Diagnostics</span>
      </div>

      {/* Primary diagnosis */}
      <div className="mb-5 flex items-start gap-3 rounded-lg bg-[var(--pc-warning-muted)] p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
        <div className="text-[13px] leading-relaxed text-amber-100">
          {device.summary.diagnosis}
        </div>
      </div>

      {/* Detailed diagnostics */}
      <div className="space-y-3">
        {device.diagnostics.map((diagnostic) => (
          <div
            key={diagnostic.code}
            className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4"
          >
            <div className="text-[13px] font-semibold text-white">{diagnostic.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--pc-text-secondary)]">
              {diagnostic.summary}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
              {diagnostic.whyItMatters}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-medium text-[var(--pc-text-muted)]">
                  Checks
                </div>
                <ul className="space-y-1.5">
                  {diagnostic.checks.map((check) => (
                    <li key={check} className="flex items-start gap-2 text-[12px] text-[var(--pc-text-secondary)]">
                      <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--pc-text-muted)]" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium text-[var(--pc-text-muted)]">
                  Raw Data
                </div>
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
          </div>
        ))}
      </div>
    </Card>
  );
}
