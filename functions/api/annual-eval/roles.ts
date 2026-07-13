import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../lib/auth";

interface RoleRow { role_key: string; user_id: number | null; full_name: string | null; updated_at: string; }

// GET /api/annual-eval/roles — who currently holds "หัวหน้าส่วนงานคุณภาพ" / "ผู้อำนวยการ / ผู้ได้รับมอบหมาย"
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(`
    SELECT r.role_key, r.user_id, u.full_name, r.updated_at
    FROM annual_eval_roles r LEFT JOIN users u ON u.id = r.user_id
  `).all<RoleRow>();

  const byKey: Record<string, RoleRow | null> = { quality_head: null, director: null };
  for (const r of rows.results ?? []) byKey[r.role_key] = r;

  return Response.json({ ok: true, roles: byKey });
};

// PUT /api/annual-eval/roles — assign which user is the quality head / director (or delegate)
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "admin", "hr")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as { role_key?: string; user_id?: number | null } | null;
  if (!body?.role_key || !["quality_head", "director"].includes(body.role_key)) {
    return Response.json({ ok: false, error: "role_key ไม่ถูกต้อง" }, { status: 400 });
  }

  const db = ctx.env.HR_DB;
  if (body.user_id != null) {
    const target = await db.prepare("SELECT id FROM users WHERE id = ? AND is_active = 1").bind(body.user_id).first();
    if (!target) return Response.json({ ok: false, error: "ไม่พบผู้ใช้งานนี้" }, { status: 404 });
  }

  await db.prepare(`
    INSERT INTO annual_eval_roles (role_key, user_id, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(role_key) DO UPDATE SET user_id = excluded.user_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(body.role_key, body.user_id ?? null, user.full_name).run();

  return Response.json({ ok: true });
};
