import type { ReactNode } from "react";
import { ArrowRight, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";

import { useAppAccessLogin, useAppAccessStatus } from "../../hooks/useAuth.js";
import { Button } from "../ui/button.js";

export function AppAccessGate({ children }: { children: ReactNode }) {
  const access = useAppAccessStatus();
  const login = useAppAccessLogin();

  if (access.isLoading) {
    return (
      <AccessShell>
        <div className="flex items-center gap-3 text-[13px] text-[var(--pc-text-secondary)]">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--pc-accent)]" />
          Checking Runway access...
        </div>
      </AccessShell>
    );
  }

  if (access.isError || !access.data) {
    return (
      <AccessShell>
        <div className="max-w-md space-y-4">
          <div>
            <div className="font-display text-2xl font-semibold text-[var(--pc-text)]">
              Could not verify access
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--pc-text-muted)]">
              Runway could not reach the local auth service. Check that the
              desktop runtime is running, then try again.
            </p>
          </div>
          <Button variant="secondary" onClick={() => access.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </AccessShell>
    );
  }

  if (!access.data.required || access.data.authenticated) {
    return <>{children}</>;
  }

  return (
    <AccessShell>
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_380px] lg:items-center">
        <section className="space-y-6">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--pc-text-secondary)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
              Tenant protected
            </div>
            <div>
              <div className="flex items-center gap-4">
                <img
                  src="/runway.png"
                  alt=""
                  className="h-12 w-12 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                />
                <div className="font-brand text-[46px] uppercase leading-none tracking-[0.16em] text-[var(--pc-text)] sm:text-[60px]">
                  Runway
                </div>
              </div>
              <h1 className="mt-5 max-w-3xl font-display text-[32px] font-semibold uppercase leading-[0.95] tracking-[0.04em] text-[var(--pc-text)] sm:text-[45px]">
                Sign in before touching the fleet picture.
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[var(--pc-text-secondary)]">
                Use your Entra account to open Runway. Elevated admin consent is
                still separate and only requested when you run privileged
                actions.
              </p>
            </div>
          </div>

          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              ["Scope", "App access only"],
              ["Actions", "Admin sign-in separate"],
              ["Recovery", "Disable in .env if needed"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-l border-[var(--pc-border)] py-2 pl-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--pc-text-muted)]">
                  {label}
                </div>
                <div className="mt-1 text-[13px] font-medium text-[var(--pc-text)]">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[20px] border border-[var(--pc-border)] bg-[color-mix(in_srgb,var(--pc-surface)_86%,transparent)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[var(--pc-accent-muted)] blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-[var(--pc-text)]">
                Continue with Entra ID
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pc-text-muted)]">
                Runway will verify your tenant identity, then open the device
                workspace.
                {access.data.allowedUsersConfigured
                  ? " Access is narrowed to configured users."
                  : " Any user in the configured tenant can enter until you add an allow-list."}
              </p>
            </div>
            <Button
              className="w-full py-2 text-[12.5px]"
              onClick={() => login.mutate()}
              disabled={login.isPending}
            >
              {login.isPending
                ? "Waiting for Microsoft..."
                : "Sign in with Microsoft"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {login.isError ? (
              <p className="rounded-xl border border-[var(--pc-critical-muted)] bg-[var(--pc-critical-muted)] p-3 text-[12px] leading-5 text-[var(--pc-critical)]">
                {login.error instanceof Error
                  ? login.error.message
                  : "Runway could not complete sign-in."}
              </p>
            ) : null}
            <p className="text-[11px] leading-5 text-[var(--pc-text-muted)]">
              First-run setup stays available while app access is disabled or
              Graph credentials are incomplete. There is no local admin password
              hiding behind this screen.
            </p>
          </div>
        </section>
      </div>
    </AccessShell>
  );
}

function AccessShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative mt-[var(--pc-titlebar-height,0px)] grid h-[calc(100vh-var(--pc-titlebar-height,0px))] overflow-y-auto overflow-x-hidden bg-[var(--pc-bg)] px-4 py-6 text-[var(--pc-text)] sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,var(--pc-accent-muted),transparent_30%),radial-gradient(circle_at_92%_4%,var(--pc-tint-hover),transparent_28%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,var(--pc-surface),transparent)] opacity-35" />
        <div className="absolute left-8 top-8 h-[calc(100%-64px)] w-px bg-[var(--pc-border)]" />
      </div>
      <div className="relative z-10 grid place-items-center">{children}</div>
    </main>
  );
}
