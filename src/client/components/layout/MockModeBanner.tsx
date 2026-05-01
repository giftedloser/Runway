import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { useSettings } from "../../hooks/useSettings.js";

/**
 * Top-of-app banner that makes mock mode obvious. We deliberately keep
 * this loud (amber, fixed at the top) so screenshots and bug reports
 * can never be confused with live data.
 */
export function MockModeBanner() {
  const settings = useSettings();
  if (settings.isLoading || !settings.data) return null;
  if (settings.data.graph.configured) return null;
  const seedMode = settings.data.appSettings.find(
    (setting) => setting.key === "developer.seedMode"
  )?.value;
  if (seedMode !== "mock") return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-4 py-1.5 text-[11.5px] text-[var(--pc-warning)]">
      <FlaskConical className="h-3.5 w-3.5" />
      <span>
        <span className="font-semibold">Demo data</span> — showing seeded sample
        data, not live Graph results.
      </span>
      <Link
        to="/settings"
        className="ml-1 underline decoration-dotted underline-offset-2 hover:text-[var(--pc-text)]"
      >
        Configure Graph credentials
      </Link>
    </div>
  );
}
