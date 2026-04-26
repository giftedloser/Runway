import fs from "node:fs";

import { ConfidentialClientApplication } from "@azure/msal-node";

import { config } from "../config.js";

type ApiVersion = "v1.0" | "beta";

const graphBase = {
  "v1.0": "https://graph.microsoft.com/v1.0",
  beta: "https://graph.microsoft.com/beta"
};

function buildAuth() {
  const base = {
    clientId: config.AZURE_CLIENT_ID ?? "",
    authority: `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}`
  };
  if (config.graphAuthMode === "certificate") {
    return {
      ...base,
      clientCertificate: {
        thumbprint: config.AZURE_CLIENT_CERT_THUMBPRINT!,
        privateKey: fs.readFileSync(config.AZURE_CLIENT_CERT_PATH!, "utf8")
      }
    };
  }
  return { ...base, clientSecret: config.AZURE_CLIENT_SECRET ?? "" };
}

export class GraphClient {
  private msal = new ConfidentialClientApplication({ auth: buildAuth() });

  async getToken() {
    const result = await this.msal.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"]
    });

    if (!result?.accessToken) {
      throw new Error("Unable to acquire Microsoft Graph token.");
    }

    return result.accessToken;
  }

  async requestJson<T>(path: string, version: ApiVersion = "v1.0", attempt = 0): Promise<T> {
    const token = await this.getToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        path.startsWith("http") ? path : `${graphBase[version]}${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          },
          signal: controller.signal
        }
      );

      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const raw = Number(response.headers.get("Retry-After") ?? "2");
        // Cap at 60s so a misbehaving Graph response cannot hang the
        // whole sync. Floor at 1s to avoid hot-loops.
        const retryAfter = Number.isFinite(raw)
          ? Math.min(Math.max(raw, 1), 60)
          : 2;
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.requestJson<T>(path, version, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`Graph request failed: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAllPages<T>(path: string, version: ApiVersion = "v1.0") {
    const results: T[] = [];
    let url: string | null = `${graphBase[version]}${path}`;

    while (url) {
      const payload: { value: T[]; "@odata.nextLink"?: string } =
        await this.requestJson<{ value: T[]; "@odata.nextLink"?: string }>(url, version);
      results.push(...(payload.value ?? []));
      url = payload["@odata.nextLink"] ?? null;
    }

    return results;
  }
}
