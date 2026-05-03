interface TauriWindow {
  __TAURI_INTERNALS__?: unknown;
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as TauriWindow);
}

async function tauriInvoke(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime not available.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command, args);
}

export async function openExternalUrl(url: string) {
  if (!isTauriRuntime()) return false;
  try {
    await tauriInvoke("open_external_url", { url });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the Microsoft sign-in URL in a new Tauri webview window so the
 * resulting localhost session cookie lives in the same WebView2 user-
 * data dir as the main window. Returns true on success, false if the
 * runtime is not Tauri or the command rejected the URL.
 */
export async function openAuthWindow(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTauriRuntime()) return { ok: false, error: "not-tauri" };
  try {
    await tauriInvoke("open_auth_window", { url });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Reveals the directory containing `path` in the OS file browser. The
 * Tauri command whitelists this to known Runway data roots, so passing
 * an arbitrary path will be rejected.
 */
export async function revealPathInExplorer(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    await tauriInvoke("reveal_path_in_explorer", { path });
    return true;
  } catch {
    return false;
  }
}
