import { useEffect, useState, type ReactNode } from "react";

const DESKTOP_URL = "http://localhost:3001";
const HEALTH_URL = `${DESKTOP_URL}/api/health`;
const STARTUP_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 350;

function isDesktopBootstrapShell() {
  if (import.meta.env.DEV) return false;
  return window.location.origin !== DESKTOP_URL;
}

export function DesktopBootstrap({ children }: { children: ReactNode }) {
  const [timedOut, setTimedOut] = useState(false);
  const shouldBootstrap = isDesktopBootstrapShell();

  useEffect(() => {
    if (!shouldBootstrap) return;

    let cancelled = false;

    async function boot() {
      const deadline = Date.now() + STARTUP_TIMEOUT_MS;

      while (!cancelled) {
        try {
          const response = await fetch(HEALTH_URL, {
            cache: "no-store",
            headers: {
              Accept: "application/json"
            }
          });

          if (response.ok) {
            window.location.replace(DESKTOP_URL);
            return;
          }
        } catch {
          // The local engine is still starting. Keep polling until timeout.
        }

        if (Date.now() >= deadline) {
          setTimedOut(true);
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [shouldBootstrap]);

  if (!shouldBootstrap) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--pc-surface)] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-6 shadow-lg shadow-black/20">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--pc-text-muted)]">
          PilotCheck
        </div>
        <h1 className="mt-3 text-xl font-semibold text-[var(--pc-text)]">
          {timedOut ? "Local engine failed to start" : "Starting desktop runtime…"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--pc-text-secondary)]">
          {timedOut
            ? "The installed app could not reach its local runtime. Close PilotCheck and reopen it. If this keeps happening, rebuild the installer so the packaged runtime is refreshed."
            : "Launching the local PilotCheck runtime and loading your existing mock-data workspace."}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[var(--pc-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--pc-accent-hover)]"
          >
            {timedOut ? "Retry startup" : "Refresh"}
          </button>
          {!timedOut ? (
            <div className="text-xs text-[var(--pc-text-muted)]">Waiting for local API on localhost:3001</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
