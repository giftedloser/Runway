import { Columns3, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils.js";
import {
  DEFAULT_VISIBLE_COLUMNS,
  DEVICE_COLUMNS,
  type DeviceColumnId
} from "./DeviceTableColumns.js";

interface ColumnPickerProps {
  value: DeviceColumnId[];
  onChange: (next: DeviceColumnId[]) => void;
}

/**
 * Lightweight popover for toggling device queue columns. Locked
 * columns (e.g. Device) cannot be switched off. "Reset" returns to the
 * default-visible set defined in the column registry.
 */
export function ColumnPicker({ value, onChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const enabled = new Set(value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const toggle = (id: DeviceColumnId) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Preserve registry order so the persisted preference matches
    // on-screen order if anyone reads it back.
    onChange(DEVICE_COLUMNS.filter((col) => next.has(col.id) || col.locked).map((col) => col.id));
  };

  const enabledCount = DEVICE_COLUMNS.filter((c) => enabled.has(c.id) || c.locked).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-1 text-[11px] text-[var(--pc-text-secondary)] transition-[background-color,color,border-color] hover:bg-[var(--pc-tint-subtle)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
        title="Choose visible columns"
        aria-label="Choose visible columns"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Columns3 className="h-3 w-3" />
        Columns
        <span className="rounded bg-black/30 px-1 py-px text-[9.5px] tabular-nums text-[var(--pc-text-muted)]">
          {enabledCount}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-60 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-1.5 shadow-xl"
          role="menu"
          aria-label="Visible columns"
        >
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Visible columns
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {DEVICE_COLUMNS.map((col) => {
              const isEnabled = col.locked || enabled.has(col.id);
              return (
                <li key={col.id}>
                  <button
                    type="button"
                    disabled={col.locked}
                    onClick={() => toggle(col.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
                      col.locked
                        ? "cursor-not-allowed text-[var(--pc-text-muted)]"
                        : "text-[var(--pc-text-secondary)] hover:bg-[var(--pc-tint-subtle)] hover:text-[var(--pc-text)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 items-center justify-center rounded border",
                        isEnabled
                          ? "border-[var(--pc-accent)] bg-[var(--pc-accent)] text-black"
                          : "border-[var(--pc-border)]"
                      )}
                    >
                      {isEnabled && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{col.label}</span>
                    {col.locked && (
                      <span className="text-[9px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                        locked
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-[var(--pc-border)] pt-1">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_VISIBLE_COLUMNS)}
              className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-subtle)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
