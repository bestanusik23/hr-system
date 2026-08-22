import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// POST   /api/exec/orientation-exclusions   body: {employee_id}  → exclude from the orientation KPI
// DELETE /api/exec/orientation-exclusions?employee_id=           → include back
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as { employee_id?: number };
  if (!body.employee_id) return Response.json({ ok: false, error: "ระบุ employee_id" }, { status: 400 });

  await ctx.env.HR_DB.prepare(
    "INSERT INTO iso_kpi_orientation_exclusions (employee_id, excluded_by) VALUES (?,?) ON CONFLICT(employee_id) DO NOTHING"
  ).bind(body.employee_id, user.full_name ?? user.username ?? "").run();

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url        = new URL(ctx.request.url);
  const employeeId = parseInt(url.searchParams.get("employee_id") ?? "", 10);
  if (!employeeId) return Response.json({ ok: false, error: "ระบุ employee_id" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM iso_kpi_orientation_exclusions WHERE employee_id = ?").bind(employeeId).run();
  return Response.json({ ok: true });
};
