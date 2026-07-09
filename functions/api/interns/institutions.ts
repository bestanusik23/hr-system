import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

// GET /api/interns/institutions?q=search — list/search existing institutions (for autocomplete)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const q = (new URL(ctx.request.url).searchParams.get("q") ?? "").trim();
  let sql = "SELECT * FROM intern_institutions";
  const params: string[] = [];
  if (q) { sql += " WHERE name LIKE ?"; params.push(`%${q}%`); }
  sql += " ORDER BY name ASC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, institutions: rows.results ?? [] });
};

// POST /api/interns/institutions — find-or-create by exact name (avoids duplicate institution rows)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const b = await ctx.request.json().catch(() => null) as { name?: string; type?: string; province?: string } | null;
  const name = b?.name?.trim();
  if (!name) return Response.json({ ok: false, error: "กรุณากรอกชื่อสถาบันการศึกษา" }, { status: 400 });

  const existing = await ctx.env.HR_DB.prepare(
    "SELECT id FROM intern_institutions WHERE name = ?"
  ).bind(name).first<{ id: number }>();
  if (existing) return Response.json({ ok: true, id: existing.id, created: false });

  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO intern_institutions (name, type, province) VALUES (?,?,?)"
  ).bind(name, b?.type ?? null, b?.province ?? null).run();

  return Response.json({ ok: true, id: result.meta.last_row_id, created: true }, { status: 201 });
};
