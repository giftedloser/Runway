import { useEffect, useId, useState } from "react";
import { HelpCircle } from "lucide-react";

import { cn } from "../../lib/utils.js";

const HELP_TIP_STORAGE_PREFIX = "runway.helpTip.hidden.";
const HELP_TIP_RESET_EVENT = "runway-help-tips-reset";

function storageKey(id: string) {
  return `${HELP_TIP_STORAGE_PREFIX}${id}`;
}

function isHidden(id: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey(id)) === "1";
}

export function resetHiddenHelpTips() {
  if (typeof window === "undefined") return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(HELP_TIP_STORAGE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
  window.dispatchEvent(new Event(HELP_TIP_RESET_EVENT));
}

export function HelpTooltip({
  id,
  children,
  dismissible = true,
  align = "center",
  tone = "default",
  className
}: {
  id: string;
  children: string;
  dismissible?: boolean;
  align?: "start" | "center" | "end";
  tone?: "default" | "sidebar";
  className?: string;
}) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => isHidden(id));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reset = () => setHidden(false);
    window.addEventListener(HELP_TIP_RESET_EVENT, reset);
    return () => window.removeEventListener(HELP_TIP_RESET_EVENT, reset);
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    window.localStorage.setItem(storageKey(id), "1");
    setHidden(true);
    setOpen(false);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
          tone === "sidebar"
            ? "border-[var(--pc-sidebar-border)] bg-transparent text-[var(--pc-sidebar-text)] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-sidebar-border)] hover:text-[var(--pc-sidebar-text-active)]"
            : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-muted)] hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)]"
        )}
        aria-label="Show help"
        aria-describedby={open ? tooltipId : undefined}
      >
        <HelpCircle aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute bottom-full z-40 mb-2 w-[240px] rounded-[var(--pc-radius-sm)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-3 text-left text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)] shadow-[var(--pc-shadow-card)]",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0"
          )}
        >
          {children}
          {dismissible ? (
            <button
              type="button"
              className="mt-2 block rounded text-[11px] font-medium text-[var(--pc-accent-hover)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              onClick={dismiss}
            >
              Got it, hide this
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
