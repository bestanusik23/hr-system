import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/training/courses/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const course = await ctx.env.HR_DB.prepare("SELECT * FROM training_courses WHERE id = ?").bind(id).first();
  if (!course) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const attendees = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_attendees WHERE course_id = ? ORDER BY id"
  ).bind(id).all();

  const photos = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_photos WHERE course_id = ? ORDER BY uploaded_at DESC"
  ).bind(id).all();

  const certs = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_certificates WHERE course_id = ? ORDER BY id"
  ).bind(id).all();

  return Response.json({ ok: true, course, attendees: attendees.results, photos: photos.results, certs: certs.results });
};

// PUT /api/training/courses/:id
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id   = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { course, course_type, organizing_dept, project_owner, trainer,
          course_date, start_time, end_time, location, month_label,
          target, budget, objectives, attachment_url, status, reg_open } = body;

  await ctx.env.HR_DB.prepare(`
    UPDATE training_courses SET
      course=?, course_type=?, organizing_dept=?, project_owner=?, trainer=?,
      course_date=?, start_time=?, end_time=?, location=?, month_label=?,
      target=?, budget=?, objectives=?, attachment_url=?, status=?, reg_open=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    course, course_type ?? "Internal",
    organizing_dept ?? null, project_owner ?? null, trainer ?? null,
    course_date ?? null, start_time ?? null, end_time ?? null,
    location ?? null, month_label ?? null,
    Number(target) || 0, Number(budget) || 0,
    objectives ?? null, attachment_url ?? null,
    status ?? "planned", reg_open ? 1 : 0,
    id
  ).run();

  return Response.json({ ok: true });
};

// DELETE /api/training/courses/:id
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  await ctx.env.HR_DB.prepare("DELETE FROM training_courses WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
};
