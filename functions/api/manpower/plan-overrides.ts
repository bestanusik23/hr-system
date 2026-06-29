import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/plan-overrides — returns {overrides: {[row_idx]: delta}}
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT row_idx, delta FROM manpower_plan_overrides"
  ).all<{ row_idx: number; delta: number }>();

  const overrides: Record<number, number> = {};
  for (const r of rows.results) overrides[r.row_idx] = r.delta;

  return Response.json({ ok: true, overrides });
};

// PATCH /api/manpower/plan-overrides — upsert {row_idx, delta}
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as { row_idx: number; delta: number };
  if (typeof body.row_idx !== "number" || typeof body.delta !== "number")
    return Response.json({ ok: false, error: "Invalid params" }, { status: 400 });

  await ctx.env.HR_DB.prepare(`
    INSERT INTO manpower_plan_overrides (row_idx, delta, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(row_idx) DO UPDATE SET
      delta=excluded.delta, updated_by=excluded.updated_by, updated_at=excluded.updated_at
  `).bind(body.row_idx, body.delta, user.username ?? user.full_name ?? null).run();

  return Response.json({ ok: true });
};
