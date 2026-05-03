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
 * Opens a URL in the system's default browser. In Tauri mode this uses
 * the existing `open_external_url` command. Returns true on success.
 */
export async function openUrlInSystemBrowser(url: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    await tauriInvoke("open_external_url", { url });
    return true;
  } catch {
    return false;
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
