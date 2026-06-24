import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await ctx.env.HR_DB.prepare("SELECT * FROM divisions ORDER BY sort_order, name").all();
  return Response.json({ ok: true, divisions: rows.results });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user || !["admin","deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { name } = await ctx.request.json() as { name: string };
  if (!name?.trim()) return Response.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
  const r = await ctx.env.HR_DB.prepare("INSERT INTO divisions (name) VALUES (?)").bind(name.trim()).run();
  return Response.json({ ok: true, id: r.meta.last_row_id }, { status: 201 });
};
