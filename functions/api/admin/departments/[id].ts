import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user || !["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  await ctx.env.HR_DB.prepare("DELETE FROM departments WHERE id = ?").bind(ctx.params.id).run();
  return Response.json({ ok: true });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user || !["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { name, division_id } = await ctx.request.json() as { name: string; division_id?: number };
  if (!name?.trim()) return Response.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
  await ctx.env.HR_DB.prepare("UPDATE departments SET name = ?, division_id = ? WHERE id = ?").bind(name.trim(), division_id ?? null, ctx.params.id).run();
  return Response.json({ ok: true });
};
