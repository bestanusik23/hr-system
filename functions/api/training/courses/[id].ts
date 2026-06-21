import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/training/courses/:id  (with attendees)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const course = await ctx.env.HR_DB.prepare("SELECT * FROM training_courses WHERE id = ?").bind(id).first();
  if (!course) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const attendees = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_attendees WHERE course_id = ? ORDER BY id"
  ).bind(id).all();

  return Response.json({ ok: true, course, attendees: attendees.results });
};

// PUT /api/training/courses/:id  (hr/admin)
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { course, trainer, course_date, month_label, target, status, attendees } = body;

  await ctx.env.HR_DB.prepare(
    "UPDATE training_courses SET course=?, trainer=?, course_date=?, month_label=?, target=?, status=?, updated_at=datetime('now') WHERE id=?"
  ).bind(course, trainer ?? null, course_date ?? null, month_label ?? null, target ?? 0, status ?? "planned", id).run();

  if (Array.isArray(attendees)) {
    await ctx.env.HR_DB.prepare("DELETE FROM training_attendees WHERE course_id = ?").bind(id).run();
    for (const a of attendees as { name: string; position?: string; result?: string; score?: number }[]) {
      if (!a.name) continue;
      await ctx.env.HR_DB.prepare(
        "INSERT INTO training_attendees (course_id, name, position, result, score) VALUES (?,?,?,?,?)"
      ).bind(id, a.name, a.position ?? null, a.result ?? null, a.score ?? null).run();
    }
  }

  return Response.json({ ok: true });
};
