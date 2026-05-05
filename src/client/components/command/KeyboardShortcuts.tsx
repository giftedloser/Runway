import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Keyboard, X } from "lucide-react";

import { cn } from "../../lib/utils.js";

interface Shortcut {
  keys: string[];
  label: string;
  /** When omitted, the shortcut is informational only (handled elsewhere). */
  action?: () => void;
}

interface ShortcutGroup {
  label: string;
  items: Shortcut[];
}

const DEVICE_DEFAULT_SEARCH = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
} as const;

/**
 * Listens for `?` to open a help overlay listing every keybind, and for
 * `g d` / `g p` / `g g` / etc. (Vim-style two-key sequences) to jump
 * directly between top-level pages. Two-key sequences time out after
 * 1.2s so accidental `g` presses don't get sticky.
 *
 * The Cmd/Ctrl+K palette is owned by CommandPalette.tsx — this component
 * just documents it in the overlay.
 */
export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const goPendingRef = useRef<number | null>(null);

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const goTo = (path: string, search?: Record<string, unknown>) => {
      void navigate({ to: path, search } as Parameters<typeof navigate>[0]);
    };

    const onKey = (event: KeyboardEvent) => {
      // Don't fight typing.
      if (isEditable(event.target)) return;
      // Don't intercept modified keys (palette uses Ctrl+K).
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // `?` opens the overlay. (Most layouts produce "?" with shift+/.)
      if (event.key === "?") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      // Two-key sequences: `g` then a destination key.
      if (goPendingRef.current !== null) {
        const handled = (() => {
          switch (event.key.toLowerCase()) {
            case "h":
            case "d":
              goTo("/");
              return true;
            case "v":
              goTo("/devices", DEVICE_DEFAULT_SEARCH);
              return true;
            case "p":
              goTo("/profiles");
              return true;
            case "g":
              goTo("/groups");
              return true;
            case "s":
              goTo("/sync");
              return true;
            case "a":
              goTo("/actions");
              return true;
            case ",":
              goTo("/settings");
              return true;
            case "c":
              goTo("/devices", { ...DEVICE_DEFAULT_SEARCH, health: "critical" });
              return true;
            default:
              return false;
          }
        })();
        window.clearTimeout(goPendingRef.current);
        goPendingRef.current = null;
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        goPendingRef.current = window.setTimeout(() => {
          goPendingRef.current = null;
        }, 1200);
      }
    };

    // Capture phase so global sequences (e.g. `g s`) preempt page-local
    // single-key handlers like DeviceShortcuts.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (goPendingRef.current !== null) {
        window.clearTimeout(goPendingRef.current);
      }
    };
  }, [navigate, open]);

  if (!open) return null;

  const groups: ShortcutGroup[] = [
    {
      label: "Global",
      items: [
        { keys: ["Ctrl", "K"], label: "Open command palette" },
        { keys: ["?"], label: "Toggle this shortcut overlay" },
        { keys: ["Esc"], label: "Close overlays" }
      ]
    },
    {
      label: "Device detail",
      items: [
        { keys: ["r"], label: "Refresh device data" },
        { keys: ["s"], label: "Sync this device" },
        { keys: ["b"], label: "Back to device queue" }
      ]
    },
    {
      label: "Go to",
      items: [
        { keys: ["g", "d"], label: "Start" },
        { keys: ["g", "v"], label: "Device Queue" },
        { keys: ["g", "c"], label: "Needs attention" },
        { keys: ["g", "p"], label: "Profiles" },
        { keys: ["g", "g"], label: "Groups" },
        { keys: ["g", "s"], label: "Sync status" },
        { keys: ["g", "a"], label: "Action history" },
        { keys: ["g", ","], label: "Settings" }
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-black/60 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">Keyboard shortcuts</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[var(--pc-text-muted)] transition-colors hover:text-[var(--pc-text)]"
            aria-label="Close shortcuts overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-[var(--pc-border)]">
          {groups.map((group) => (
            <div key={group.label} className="px-5 py-3.5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
                {group.label}
              </div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-[12.5px] text-[var(--pc-text-secondary)]">
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((key, idx) => (
                        <Kbd key={idx}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-5 py-2.5 text-[10.5px] text-[var(--pc-text-muted)]">
          Two-key sequences (e.g. <Kbd>g</Kbd> <Kbd>d</Kbd>) time out after 1.2 seconds.
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--pc-border)]",
        "bg-[var(--pc-surface-raised)] px-1.5 font-mono text-[10.5px] font-medium text-[var(--pc-text-secondary)]"
      )}
    >
      {children}
    </kbd>
  );
}
