/// <reference types="@cloudflare/workers-types" />
import type { Env } from "./types";

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  role: "hr" | "head" | "deputy" | "deputyHR" | "admin";
  role_title: string | null;
  scope_division_id: number | null;
  scope_department_id: number | null;
  color: string | null;
  initial: string | null;
}

// ---------- password hashing (PBKDF2-SHA256 via Web Crypto) ----------

export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const s = salt ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(s), iterations: 100_000 },
    key, 256,
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt: s };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

// ---------- session token ----------

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(db: D1Database, userId: number, userAgent: string): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8h
  await db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)"
  ).bind(token, userId, expiresAt, userAgent).run();
  return token;
}

export async function getSessionUser(db: D1Database, token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.role_title,
           u.scope_division_id, u.scope_department_id, u.color, u.initial
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).bind(token).first<SessionUser>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

// ---------- cookie helpers ----------

export function getTokenFromCookie(request: Request): string {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)hr_session=([^;]+)/);
  return match?.[1] ?? "";
}

export function makeSessionCookie(token: string, maxAge: number): string {
  return `hr_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

// ---------- middleware ----------

export async function requireAuth(
  ctx: EventContext<Env, string, unknown>,
  next: () => Promise<Response>,
): Promise<Response> {
  const token = getTokenFromCookie(ctx.request);
  const user = await getSessionUser(ctx.env.HR_DB, token);
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  (ctx.data as Record<string, unknown>).user = user;
  return next();
}
