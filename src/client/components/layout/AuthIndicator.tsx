import { Link } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";

import { useAuthStatus, useLogin, useLogout } from "../../hooks/useAuth.js";

export function AuthIndicator() {
  const auth = useAuthStatus();
  const login = useLogin();
  const logout = useLogout();

  if (auth.isLoading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--pc-text-muted)]">
        <div className="h-3 w-3 animate-spin rounded-full border border-[var(--pc-accent)] border-t-transparent" />
        Checking session…
      </div>
    );
  }

  if (!auth.data?.authenticated) {
    if (!login.canStart) {
      return (
        <Link
          to="/settings"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--pc-warning)]/25 bg-[var(--pc-warning-muted)] px-2.5 py-2 text-[11.5px] font-medium text-[var(--pc-warning)] transition-colors hover:border-[var(--pc-warning)]/45 hover:text-[var(--pc-text)]"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <LogIn className="h-3 w-3 shrink-0" />
            <span className="truncate">Configure sign-in</span>
          </span>
          <span className="shrink-0 text-[10px] text-[var(--pc-text-muted)]">Settings</span>
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => login.mutate()}
        disabled={login.isPending}
        title={login.blockedReason ?? undefined}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-2 text-[11.5px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-accent-hover)] disabled:opacity-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <LogIn className="h-3 w-3 shrink-0" />
          <span className="truncate">Admin sign-in</span>
        </span>
        <span className="shrink-0 text-[10px] text-[var(--pc-text-muted)]">Entra</span>
      </button>
    );
  }

  const initial = (auth.data.name ?? auth.data.user ?? "?").charAt(0).toUpperCase();

  return (
    <div className="group relative">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-1.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pc-accent)] text-[10px] font-semibold text-[var(--pc-text)]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-medium text-[var(--pc-text)]">
            {auth.data.name ?? auth.data.user}
          </div>
          <div className="flex items-center gap-1 text-[9.5px] text-[var(--pc-healthy)]">
            <span className="h-1 w-1 rounded-full bg-[var(--pc-healthy)]" />
            Authenticated
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)]"
          title="Sign out"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
