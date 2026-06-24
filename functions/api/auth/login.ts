import type { Env } from "../../lib/types";
import { verifyPassword, createSession, makeSessionCookie } from "../../lib/auth";

interface LoginBody { username: string; password: string; }
interface UserRow {
  id: number; username: string; password_hash: string; password_salt: string;
  full_name: string; role: string; role_title: string | null;
  scope_division_id: number | null; scope_department_id: number | null;
  color: string | null; initial: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: LoginBody;
  try { body = await ctx.request.json(); } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return Response.json({ ok: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const user = await ctx.env.HR_DB.prepare(
    "SELECT id, username, password_hash, password_salt, full_name, role, role_title, scope_division_id, scope_department_id, color, initial FROM users WHERE username = ? AND is_active = 1"
  ).bind(username.trim()).first<UserRow>();

  if (!user) {
    return Response.json({ ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) {
    return Response.json({ ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const ua = ctx.request.headers.get("User-Agent") ?? "";
  const token = await createSession(ctx.env.HR_DB, user.id, ua);

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, detail) VALUES (?, ?, 'auth', 'login', ?)"
    ).bind(user.id, user.full_name, `login from ${ctx.request.headers.get("CF-Connecting-IP") ?? "unknown"}`).run();
  } catch { /* ignore */ }

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, role_title: user.role_title, scope_division_id: user.scope_division_id, scope_department_id: user.scope_department_id, color: user.color, initial: user.initial },
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeSessionCookie(token, 28800),
    },
  });
};
