import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await ctx.env.HR_DB.prepare(
    "SELECT d.*, dv.name AS division_name FROM departments d LEFT JOIN divisions dv ON dv.id = d.division_id ORDER BY dv.name, d.name"
  ).all();
  return Response.json({ ok: true, departments: rows.results });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user || !["admin","deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { name, division_id } = await ctx.request.json() as { name: string; division_id?: number };
  if (!name?.trim()) return Response.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
  const r = await ctx.env.HR_DB.prepare("INSERT INTO departments (name, division_id) VALUES (?, ?)").bind(name.trim(), division_id ?? null).run();
  return Response.json({ ok: true, id: r.meta.last_row_id }, { status: 201 });
};
