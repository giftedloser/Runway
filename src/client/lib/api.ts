const DESKTOP_API_ORIGIN = "http://localhost:3001";
const DESKTOP_TOKEN_HEADER = "X-Runway-Desktop-Token";

// Emitted whenever the server rejects a request with 401. UnauthenticatedListener
// subscribes so that the auth query is invalidated and the user is prompted to
// sign in again, even if the error originates from a background query.
export const UNAUTHENTICATED_EVENT = "pilotcheck:unauthenticated";

export interface UnauthenticatedEventDetail {
  path: string;
  message: string;
}

interface TauriWindow {
  __TAURI_INTERNALS__?: unknown;
}

let desktopTokenPromise: Promise<string | null> | null = null;

function resolveRequestUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (!import.meta.env.DEV && typeof window !== "undefined" && window.location.origin !== DESKTOP_API_ORIGIN) {
    return new URL(path, DESKTOP_API_ORIGIN).toString();
  }

  return path;
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as TauriWindow);
}

async function getDesktopApiToken() {
  if (!isTauriRuntime()) return null;
  desktopTokenPromise ??= import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke<string>("get_desktop_api_token"))
    .catch(() => null);
  return desktopTokenPromise;
}

function isJsonResponse(response: Response) {
  return (response.headers.get("content-type") ?? "").includes("application/json");
}

async function readErrorMessage(response: Response) {
  if (isJsonResponse(response)) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return payload?.message ?? response.statusText;
  }

  const text = await response.text().catch(() => "");
  return text.trim() || response.statusText;
}

function emitUnauthenticated(path: string, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UnauthenticatedEventDetail>(UNAUTHENTICATED_EVENT, {
      detail: { path, message }
    })
  );
}

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const requestUrl = resolveRequestUrl(path);
  const desktopToken = await getDesktopApiToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (desktopToken) {
    headers.set(DESKTOP_TOKEN_HEADER, desktopToken);
  }

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(`Runway could not reach its local runtime for ${path}.`);
  }

  if (!response.ok) {
    const message = (await readErrorMessage(response)) ?? "Request failed.";
    if (response.status === 401) {
      emitUnauthenticated(path, message);
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJsonResponse(response)) {
    throw new Error(`Runway expected JSON from ${path} but received a different response.`);
  }

  return (await response.json()) as T;
}
