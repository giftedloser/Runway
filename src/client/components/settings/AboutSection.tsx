import { BookOpen, ExternalLink, FileText, Info } from "lucide-react";

import type { SettingsAbout } from "../../lib/types.js";
import { Card } from "../ui/card.js";
import { SettingsSectionHeader } from "./SettingsShared.js";

const LINKS = [
  {
    label: "Changelog",
    href: "https://github.com/giftedloser/Runway/blob/main/CHANGELOG.md",
    icon: FileText
  },
  {
    label: "Documentation",
    href: "https://github.com/giftedloser/Runway#readme",
    icon: BookOpen
  },
  {
    label: "Support / issues",
    href: "https://github.com/giftedloser/Runway/issues",
    icon: ExternalLink
  }
] as const;

export function AboutSection({ about }: { about: SettingsAbout }) {
  return (
    <section id="about" className="scroll-mt-6 space-y-3">
      <SettingsSectionHeader
        index="7"
        title="About"
        detail="Version, database migration state, and project links"
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)]">
              <Info className="h-4 w-4 text-[var(--pc-accent-hover)]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--pc-text)]">Runway</div>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                Local-first Autopilot, Intune, and Entra triage for small-to-mid IT teams.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[var(--pc-border)] md:grid-cols-4">
          <AboutMetric label="App version" value={about.appVersion} />
          <AboutMetric label="Database schema" value={about.databaseSchemaVersion} />
          <AboutMetric label="Last migration" value={about.lastMigration ?? "None"} />
          <AboutMetric label="Log level" value={about.logLevel} />
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-3">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4 transition-[border-color,background-color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              >
                <Icon className="h-4 w-4 text-[var(--pc-accent)]" />
                <div className="mt-3 text-[13px] font-semibold text-[var(--pc-text)]">{link.label}</div>
                <div className="mt-1 truncate text-[11px] text-[var(--pc-text-muted)]">{link.href}</div>
              </a>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

function AboutMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--pc-surface)] px-4 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[12px] text-[var(--pc-text)]">{value}</div>
    </div>
  );
}
