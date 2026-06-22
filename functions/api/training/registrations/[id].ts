import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// PUT /api/training/registrations/:id — update attendance status
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id   = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { attendance_status, result, score } = body;

  const VALID = ["registered", "checked_in", "late", "absent", "completed"];
  if (attendance_status && !VALID.includes(attendance_status as string)) {
    return Response.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(`
    UPDATE training_attendees SET
      attendance_status = COALESCE(?, attendance_status),
      result = COALESCE(?, result),
      score  = COALESCE(?, score),
      checkin_time = CASE WHEN ? IN ('checked_in','late') AND checkin_time IS NULL THEN datetime('now') ELSE checkin_time END
    WHERE id = ?
  `).bind(
    attendance_status ?? null,
    result ?? null,
    score  ?? null,
    attendance_status ?? null,
    id
  ).run();

  return Response.json({ ok: true });
};

// DELETE /api/training/registrations/:id
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  await ctx.env.HR_DB.prepare("DELETE FROM training_attendees WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
};
