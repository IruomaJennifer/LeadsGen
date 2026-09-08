import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { config } from "./config";

export const SESSION_COOKIE_NAME = "leada_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", config.appAuthSecret).update(data).digest("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A readable-ish temporary password for admin-created accounts, emailed to
// the new user and mandatory to change on first login.
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url"); // 12 chars, url-safe
}

export function createSessionToken(userId: string, email: string, role: string, mustChangePassword: boolean): string {
  const payload: SessionPayload = { userId, email, role, mustChangePassword, exp: Date.now() + SESSION_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// For server-side actions that need to know *who* is actually making the
// call (e.g. auto-claiming an unassigned lead) — reads straight from the
// request's cookie rather than trusting a client-supplied identity.
export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
