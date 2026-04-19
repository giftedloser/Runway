const DESKTOP_API_ORIGIN = "http://localhost:3001";

function resolveRequestUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (!import.meta.env.DEV && typeof window !== "undefined" && window.location.origin !== DESKTOP_API_ORIGIN) {
    return new URL(path, DESKTOP_API_ORIGIN).toString();
  }

  return path;
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

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const requestUrl = resolveRequestUrl(path);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      ...init
    });
  } catch {
    throw new Error(`PilotCheck could not reach its local runtime for ${path}.`);
  }

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJsonResponse(response)) {
    throw new Error(`PilotCheck expected JSON from ${path} but received a different response.`);
  }

  return (await response.json()) as T;
}
