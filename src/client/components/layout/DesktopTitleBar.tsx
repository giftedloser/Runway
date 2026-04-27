import { Copy, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils.js";

const TITLEBAR_HEIGHT_PX = 38;

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type TauriWindow = Awaited<ReturnType<typeof import("@tauri-apps/api/window").getCurrentWindow>>;

async function getWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function DesktopTitleBar() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      document.documentElement.style.setProperty("--pc-titlebar-height", "0px");
      document.documentElement.removeAttribute("data-desktop-titlebar");
      return;
    }

    let cancelled = false;
    setIsDesktop(true);
    document.documentElement.style.setProperty("--pc-titlebar-height", `${TITLEBAR_HEIGHT_PX}px`);
    document.documentElement.setAttribute("data-desktop-titlebar", "true");

    void getWindow()
      .then((appWindow) => appWindow.isMaximized())
      .then((maximized) => {
        if (!cancelled) setIsMaximized(maximized);
      })
      .catch(() => {
        if (!cancelled) setIsMaximized(false);
      });

    return () => {
      cancelled = true;
      document.documentElement.style.setProperty("--pc-titlebar-height", "0px");
      document.documentElement.removeAttribute("data-desktop-titlebar");
    };
  }, []);

  const runWindowAction = useCallback(
    async (action: (appWindow: TauriWindow) => Promise<void>) => {
      setControlError(null);
      try {
        const appWindow = await getWindow();
        await action(appWindow);
      } catch (error) {
        setControlError(error instanceof Error ? error.message : "Window control failed.");
      }
    },
    []
  );

  const toggleMaximize = useCallback(async () => {
    await runWindowAction(async (appWindow) => {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    });
  }, [runWindowAction]);

  if (!isDesktop) return null;

  return (
    <header
      data-tauri-drag-region
      className="fixed left-0 top-0 z-[90] flex h-[38px] w-screen select-none items-center border-b border-[var(--pc-titlebar-border)] bg-[var(--pc-titlebar-bg)] text-[var(--pc-titlebar-text)] backdrop-blur-xl"
      onDoubleClick={() => {
        void toggleMaximize();
      }}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
      >
        <img
          src="/runway.png"
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] shrink-0 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.22)]"
        />
        <div
          data-tauri-drag-region
          className="font-brand text-[15px] uppercase leading-none tracking-[0.2em]"
        >
          Runway
        </div>
        <div
          data-tauri-drag-region
          className="hidden truncate border-l border-[var(--pc-titlebar-border)] pl-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--pc-titlebar-text-muted)] sm:block"
        >
          Fleet readiness console
        </div>
        {controlError ? (
          <div
            className="ml-2 hidden rounded-full border border-[var(--pc-critical-muted)] bg-[var(--pc-critical-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pc-critical)] md:block"
            title={controlError}
          >
            Window control unavailable
          </div>
        ) : null}
      </div>

      <div className="flex h-full items-stretch" onDoubleClick={(event) => event.stopPropagation()}>
        <WindowButton
          label="Minimize window"
          onClick={() => {
            void runWindowAction((appWindow) => appWindow.minimize());
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </WindowButton>
        <WindowButton
          label={isMaximized ? "Restore window" : "Maximize window"}
          onClick={() => {
            void toggleMaximize();
          }}
        >
          {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </WindowButton>
        <WindowButton
          label="Close window"
          danger
          onClick={() => {
            void runWindowAction((appWindow) => appWindow.close());
          }}
        >
          <X className="h-3.5 w-3.5" />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({
  children,
  danger = false,
  label,
  onClick
}: {
  children: ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid w-11 place-items-center text-[var(--pc-titlebar-control)] transition-[background-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--pc-accent)]",
        danger
          ? "hover:bg-[#d93025] hover:text-[var(--pc-accent-contrast)]"
          : "hover:bg-[var(--pc-titlebar-control-hover)] hover:text-[var(--pc-titlebar-text)]"
      )}
    >
      {children}
    </button>
  );
}
