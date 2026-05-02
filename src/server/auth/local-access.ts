import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import type { Request, Response, NextFunction } from "express";

import { config } from "../config.js";
import {
  hasValidAppAccessSession,
  hasValidDelegatedSession
} from "./auth-middleware.js";

const DESKTOP_TOKEN_HEADER = "x-runway-desktop-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isLoopbackRemote(remote: string | undefined) {
  if (!remote) return false;
  return (
    remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1"
  );
}

/**
 * Constant-time desktop-token comparison. The token is loopback-only and
 * minted fresh per app launch, so the timing-attack window is narrow, but
 * timingSafeEqual is one line and removes the question entirely. Returns
 * false for missing tokens, length mismatches, or invalid UTF-8 — never
 * throws.
 */
export function hasDesktopToken(request: Request) {
  const expected = config.RUNWAY_DESKTOP_TOKEN;
  if (!expected) return false;
  const presented = request.get(DESKTOP_TOKEN_HEADER);
  if (typeof presented !== "string" || presented.length === 0) return false;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const presentedBuffer = Buffer.from(presented, "utf8");
  if (presentedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(presentedBuffer, expectedBuffer);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  // Tauri webviews on Windows omit Origin or send "tauri://localhost".
  // Same-origin XHR from our own client also omits Origin. Anything else
  // (a random browser tab on the user's machine) is rejected on
  // mutating methods to defeat CSRF against the loopback API.
  if (!origin || origin === "null") return true;
  if (origin.startsWith("tauri://")) return true;
  const allowedWebOrigins = new Set([
    `http://localhost:${config.PORT}`,
    `http://127.0.0.1:${config.PORT}`,
    `http://localhost:${config.CLIENT_PORT}`,
    `http://127.0.0.1:${config.CLIENT_PORT}`
  ]);
  try {
    const url = new URL(origin);
    if (allowedWebOrigins.has(url.origin)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Gates every /api/* route on the loopback server. A request is allowed
 * when it carries the per-install desktop token, a valid delegated
 * session, or a valid app-access session. Mutating methods additionally
 * require an allowed Origin so a malicious browser tab on the same
 * workstation cannot pivot off cookies it inherited.
 */
export function requireLocalAccess(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (config.isDevOrTest) {
    enforceOrigin(request, response, next);
    return;
  }

  const ok =
    hasDesktopToken(request) ||
    hasValidDelegatedSession(request) ||
    hasValidAppAccessSession(request) ||
    // First-run wizard: when no desktop token is configured *and* the
    // server is loopback-only, we let the request through so the operator
    // can populate Graph credentials. config.ts pins the bind address.
    (!config.RUNWAY_DESKTOP_TOKEN && isLoopbackRemote(request.socket.remoteAddress));

  if (!ok) {
    response.status(401).json({ message: "Local Runway access required." });
    return;
  }

  enforceOrigin(request, response, next);
}

function enforceOrigin(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (!MUTATING_METHODS.has(request.method)) {
    next();
    return;
  }
  if (!isAllowedOrigin(request.get("origin"))) {
    response.status(403).json({ message: "Cross-origin request blocked." });
    return;
  }
  next();
}
