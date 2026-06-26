import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser, hashPassword } from "../../lib/auth";

// GET /api/admin/users
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["admin","deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT u.id, u.username, u.full_name, u.role, u.role_2, u.role_3, u.role_title,
            u.scope_division_id, u.scope_division_id_2, u.scope_division_id_3,
            u.scope_department_id, u.is_active, u.created_at,
            dv.name AS division_name, dp.name AS department_name
     FROM users u
     LEFT JOIN divisions   dv ON dv.id = u.scope_division_id
     LEFT JOIN departments dp ON dp.id = u.scope_department_id
     ORDER BY u.id`
  ).all();
  return Response.json({ ok: true, users: rows.results });
};

// POST /api/admin/users — create new user
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["admin","deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = await ctx.request.json() as Record<string, unknown>;
    const { username, password, full_name, role, role_2, role_3, role_title,
            scope_division_id, scope_division_id_2, scope_division_id_3, scope_department_id } = body;

    if (!username || !password || !full_name || !role) {
      return Response.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const exists = await ctx.env.HR_DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (exists) return Response.json({ ok: false, error: "Username นี้มีอยู่แล้ว" }, { status: 409 });

    const { hash, salt } = await hashPassword(password as string);
    const result = await ctx.env.HR_DB.prepare(
      "INSERT INTO users (username, password_hash, password_salt, full_name, role, role_2, role_3, role_title, scope_division_id, scope_division_id_2, scope_division_id_3, scope_department_id, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)"
    ).bind(username, hash, salt, full_name, role, role_2 ?? null, role_3 ?? null, role_title ?? null,
           scope_division_id ?? null, scope_division_id_2 ?? null, scope_division_id_3 ?? null,
           scope_department_id ?? null).run();

    try {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'admin','create_user','user',?)"
      ).bind(user.id, user.full_name, result.meta.last_row_id).run();
    } catch { /* ignore */ }

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
