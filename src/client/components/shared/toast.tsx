import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "../../lib/utils.js";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. 0 disables auto-dismiss. Defaults to 5000. */
  durationMs?: number;
}

interface Toast extends Required<Omit<ToastInput, "description">> {
  id: number;
  description: string | undefined;
}

interface ToastContextValue {
  push: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Lightweight global toast hub. Toasts are stacked top-right, auto-dismiss
 * by default, and survive route transitions because the provider sits at the
 * AppShell level. We deliberately avoid pulling in a third-party toast lib
 * because we only need a few hundred lines of behavior and want full control
 * over styling against the --pc-* design tokens.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const toast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
        durationMs: input.durationMs ?? 5000
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), toast.durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  // Clean up any outstanding timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success:
    "border-[var(--pc-healthy)]/40 bg-[var(--pc-healthy-muted)]/95 text-emerald-50",
  error:
    "border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)]/95 text-red-50",
  warning:
    "border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)]/95 text-amber-50",
  info:
    "border-[var(--pc-info)]/40 bg-[var(--pc-info-muted)]/95 text-sky-50"
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: "text-[var(--pc-healthy)]",
  error: "text-[var(--pc-critical)]",
  warning: "text-[var(--pc-warning)]",
  info: "text-[var(--pc-info)]"
};

function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-2xl backdrop-blur-sm",
              "pc-toast-enter",
              VARIANT_STYLES[toast.variant]
            )}
            role="status"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_STYLES[toast.variant])} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold leading-snug">{toast.title}</div>
              {toast.description && (
                <div className="mt-0.5 text-[11.5px] leading-snug opacity-90">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-mr-1 -mt-0.5 rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              aria-label="Dismiss notification"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
