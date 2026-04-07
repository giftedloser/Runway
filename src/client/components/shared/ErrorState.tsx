import { AlertOctagon, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
}

function asMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  onRetry,
  children
}: ErrorStateProps) {
  const detail = message ?? asMessage(error) ?? "The data could not be loaded.";
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--pc-critical-muted)]">
          <AlertOctagon className="h-4 w-4 text-[var(--pc-critical)]" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">{detail}</div>
        </div>
      </div>
      {children}
      {onRetry ? (
        <Button className="h-8 px-3 text-[12px]" onClick={onRetry}>
          <RefreshCcw className="h-3 w-3" />
          Retry
        </Button>
      ) : null}
    </Card>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
      {label}
    </div>
  );
}
