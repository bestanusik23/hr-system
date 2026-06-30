import { getSessionUser, getTokenFromCookie } from "../lib/auth";

interface Env { HR_DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT id, icon, text, kind, link, is_read, created_at
     FROM notifications
     WHERE (target_user_id = ? OR target_role = ?)
       AND is_read = 0
     ORDER BY created_at DESC
     LIMIT 30`
  ).bind(user.id, user.role).all();

  return Response.json({ ok: true, notifications: rows.results });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const url = new URL(ctx.request.url);
  const id = url.searchParams.get("id");

  if (id) {
    await ctx.env.HR_DB.prepare(
      `UPDATE notifications SET is_read = 1
       WHERE id = ? AND (target_user_id = ? OR target_role = ?)`
    ).bind(Number(id), user.id, user.role).run();
  } else {
    await ctx.env.HR_DB.prepare(
      `UPDATE notifications SET is_read = 1
       WHERE (target_user_id = ? OR target_role = ?) AND is_read = 0`
    ).bind(user.id, user.role).run();
  }

  return Response.json({ ok: true });
};
