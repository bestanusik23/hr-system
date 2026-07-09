import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

interface RotationInput {
  department_id?: number | null; division_id?: number | null;
  start_date: string; end_date: string; supervisor_name?: string | null; note?: string | null;
}

// POST /api/interns/:id/rotations — replace the full rotation set for this intern
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const internId = ctx.params.id as string;
  const body = await ctx.request.json().catch(() => null) as { rotations?: RotationInput[] } | null;
  if (!body || !Array.isArray(body.rotations)) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const db = ctx.env.HR_DB;
  await db.prepare("DELETE FROM intern_rotations WHERE intern_id = ?").bind(internId).run();

  let i = 0;
  for (const r of body.rotations) {
    if (!r.start_date || !r.end_date) continue;
    await db.prepare(`
      INSERT INTO intern_rotations (intern_id, department_id, division_id, start_date, end_date, supervisor_name, note, sort_order)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      internId, r.department_id ?? null, r.division_id ?? null,
      r.start_date, r.end_date, r.supervisor_name ?? null, r.note ?? null, i,
    ).run();
    i++;
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'intern','update_rotations','intern',?)"
    ).bind(user.id, user.full_name, internId).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, count: i });
};
