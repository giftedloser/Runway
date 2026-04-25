import { AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { Button } from "../ui/button.js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireTyped?: string;
  typedValue?: string;
  onTypedChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireTyped,
  typedValue = "",
  onTypedChange,
  onConfirm,
  onCancel,
  isLoading,
  confirmDisabled: confirmBlocked = false
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: keep Tab cycling within the dialog
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    // Auto-focus the dialog when it opens (if no autoFocus input)
    if (!requireTyped && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector<HTMLElement>("button");
      firstButton?.focus();
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown, requireTyped]);

  if (!open) return null;

  const confirmDisabled =
    isLoading || confirmBlocked || (Boolean(requireTyped) && typedValue.trim() !== requireTyped);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pc-modal-enter w-full max-w-md rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            {destructive ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]">
                <AlertTriangle className="h-4 w-4" />
              </div>
            ) : null}
            <div>
              <div className="text-[14px] font-semibold text-[var(--pc-text)]">{title}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-relaxed text-[var(--pc-text-secondary)]">
            {description}
          </p>
          {requireTyped ? (
            <div className="mt-4 space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                Type <span className="font-mono text-[var(--pc-critical)]">{requireTyped}</span> to confirm
              </label>
              <input
                type="text"
                value={typedValue}
                onChange={(event) => onTypedChange?.(event.target.value)}
                className="w-full rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2 font-mono text-[12.5px] text-[var(--pc-text)] outline-none transition-colors focus:border-[var(--pc-accent)]"
                autoFocus
              />
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--pc-border)] px-5 py-3">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {isLoading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
