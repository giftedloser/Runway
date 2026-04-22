import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    delegatedToken?: string;
    delegatedUser?: string;
    delegatedName?: string;
    delegatedExpiresAt?: string;
    oauthState?: string;
  }
}

export function hasValidDelegatedSession(request: Request): boolean {
  const session = request.session;
  if (!session.delegatedToken) {
    return false;
  }
  if (session.delegatedExpiresAt && new Date(session.delegatedExpiresAt) < new Date()) {
    session.delegatedToken = undefined;
    session.delegatedUser = undefined;
    session.delegatedName = undefined;
    session.delegatedExpiresAt = undefined;
    return false;
  }
  return true;
}

export function requireDelegatedAuth(request: Request, response: Response, next: NextFunction) {
  if (!hasValidDelegatedSession(request)) {
    response.status(401).json({ message: "Admin login required for this action." });
    return;
  }
  next();
}

export function getDelegatedToken(request: Request): string {
  return request.session.delegatedToken!;
}

export function getDelegatedUser(request: Request): string {
  return request.session.delegatedUser ?? "unknown";
}
