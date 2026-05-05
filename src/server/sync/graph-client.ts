import { logger } from "../logger.js";

type ApiVersion = "v1.0" | "beta";

const graphBase = {
  "v1.0": "https://graph.microsoft.com/v1.0",
  beta: "https://graph.microsoft.com/beta"
};

export class GraphClient {
  private delegatedToken: string;

  constructor(delegatedToken: string) {
    if (!delegatedToken) {
      throw new Error(
        "GraphClient requires a delegated access token. " +
          "Pass the session's delegatedToken — never call new GraphClient() without one."
      );
    }
    this.delegatedToken = delegatedToken;
  }

  async getToken() {
    return this.delegatedToken;
  }

  async requestJson<T>(path: string, version: ApiVersion = "v1.0", attempt = 0): Promise<T> {
    const token = await this.getToken();
    const fullUrl = path.startsWith("http") ? path : `${graphBase[version]}${path}`;
    logger.info({ url: fullUrl, attempt }, "[graph] → GET");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const raw = Number(response.headers.get("Retry-After") ?? "2");
        // Cap at 60s so a misbehaving Graph response cannot hang the
        // whole sync. Floor at 1s to avoid hot-loops.
        const retryAfter = Number.isFinite(raw)
          ? Math.min(Math.max(raw, 1), 10)
          : 2;
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.requestJson<T>(path, version, attempt + 1);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.error({ url: fullUrl, status: response.status, body }, "[graph] ✗ response");
        throw new Error(`Graph request failed: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAllPages<T>(path: string, version: ApiVersion = "v1.0", maxPages = 200) {
    const results: T[] = [];
    let url: string | null = `${graphBase[version]}${path}`;
    const seen = new Set<string>();

    while (url) {
      if (seen.has(url)) {
        throw new Error(`Graph pagination loop detected for ${path}`);
      }
      if (seen.size >= maxPages) {
        throw new Error(`Graph pagination exceeded ${maxPages} pages for ${path}`);
      }
      seen.add(url);
      const payload: { value: T[]; "@odata.nextLink"?: string } =
        await this.requestJson<{ value: T[]; "@odata.nextLink"?: string }>(url, version);
      results.push(...(payload.value ?? []));
      url = payload["@odata.nextLink"] ?? null;
    }

    return results;
  }
}
