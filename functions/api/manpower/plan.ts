import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/plan — full plan rows ordered by sort_order
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT id, row_idx, type, name, pos, div_id, plan_qty, note, sort_order, is_active
     FROM manpower_plan WHERE is_active = 1 ORDER BY sort_order`
  ).all();

  return Response.json({ ok: true, plan: rows.results });
};

// PATCH /api/manpower/plan/:rowIdx — update plan_qty and/or note for one row
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const rowIdx = parseInt(url.searchParams.get("row_idx") ?? "");
  if (isNaN(rowIdx)) return Response.json({ ok: false, error: "row_idx required" }, { status: 400 });

  const body = await ctx.request.json() as { plan_qty?: number; note?: string; name?: string };

  const sets: string[] = ["updated_at = datetime('now')", "updated_by = ?"];
  const vals: (string | number)[] = [user.full_name ?? user.username ?? ""];

  if (typeof body.plan_qty === "number") { sets.push("plan_qty = ?"); vals.push(Math.max(0, body.plan_qty)); }
  if (typeof body.note   === "string")  { sets.push("note = ?");     vals.push(body.note); }
  if (typeof body.name   === "string")  { sets.push("name = ?");     vals.push(body.name); }

  if (sets.length === 2) return Response.json({ ok: false, error: "Nothing to update" }, { status: 400 });

  vals.push(rowIdx);
  await ctx.env.HR_DB.prepare(
    `UPDATE manpower_plan SET ${sets.join(", ")} WHERE row_idx = ?`
  ).bind(...vals).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','edit_plan','plan_row',?)"
    ).bind(user.id, user.full_name, rowIdx).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
