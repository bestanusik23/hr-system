import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/training/photos?course_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url       = new URL(ctx.request.url);
  const course_id = url.searchParams.get("course_id") ?? "";
  if (!course_id) return Response.json({ ok: false, error: "Missing course_id" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_photos WHERE course_id = ? ORDER BY uploaded_at DESC"
  ).bind(course_id).all();
  return Response.json({ ok: true, photos: rows.results });
};

// POST /api/training/photos  — add photo URL
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { course_id, url: photoUrl, photo_type, caption } = body;

  if (!course_id || !photoUrl) return Response.json({ ok: false, error: "Missing course_id or url" }, { status: 400 });

  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO training_photos (course_id, url, photo_type, caption) VALUES (?, ?, ?, ?)"
  ).bind(course_id, photoUrl, photo_type ?? "activity", caption ?? null).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};

// DELETE /api/training/photos/:id handled via separate file
