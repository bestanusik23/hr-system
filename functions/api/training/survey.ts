import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

interface SurveyBody {
  token: string; attendee_id?: number;
  q1: number; q2: number; q3: number; q4: number; q5: number;
  comment?: string;
}

// POST /api/training/survey  — public, submit satisfaction survey
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json() as SurveyBody;
  const { token, attendee_id, q1, q2, q3, q4, q5, comment } = body;

  if (!token || !q1 || !q2 || !q3 || !q4 || !q5) {
    return Response.json({ ok: false, error: "กรุณาตอบคำถามให้ครบถ้วน" }, { status: 400 });
  }
  for (const q of [q1, q2, q3, q4, q5]) {
    if (![1, 2, 3, 4].includes(Number(q))) {
      return Response.json({ ok: false, error: "คะแนนไม่ถูกต้อง (ต้องเป็น 1–4)" }, { status: 400 });
    }
  }

  const course = await ctx.env.HR_DB.prepare(
    "SELECT id FROM training_courses WHERE qr_token = ? AND COALESCE(is_cancelled, 0) = 0"
  ).bind(token).first<{ id: number }>();

  if (!course) return Response.json({ ok: false, error: "ไม่พบหลักสูตร" }, { status: 404 });

  if (attendee_id) {
    const dup = await ctx.env.HR_DB.prepare(
      "SELECT id FROM training_surveys WHERE course_id = ? AND attendee_id = ?"
    ).bind(course.id, attendee_id).first();
    if (dup) return Response.json({ ok: true, duplicate: true });
  }

  await ctx.env.HR_DB.prepare(`
    INSERT INTO training_surveys (course_id, attendee_id, q1, q2, q3, q4, q5, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    course.id, attendee_id ?? null,
    Number(q1), Number(q2), Number(q3), Number(q4), Number(q5),
    comment?.trim() ?? null
  ).run();

  return Response.json({ ok: true }, { status: 201 });
};

// GET /api/training/survey?course_id=xxx  — auth required, get survey results
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url       = new URL(ctx.request.url);
  const course_id = url.searchParams.get("course_id") ?? "";
  if (!course_id) return Response.json({ ok: false, error: "Missing course_id" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_surveys WHERE course_id = ? ORDER BY submitted_at"
  ).bind(course_id).all();

  return Response.json({ ok: true, surveys: rows.results });
};
