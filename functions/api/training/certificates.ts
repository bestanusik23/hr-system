import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/training/certificates?course_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url       = new URL(ctx.request.url);
  const course_id = url.searchParams.get("course_id") ?? "";

  let sql    = "SELECT * FROM training_certificates WHERE 1=1";
  const params: (string | number)[] = [];
  if (course_id) { sql += " AND course_id = ?"; params.push(course_id); }
  sql += " ORDER BY issued_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, certificates: rows.results });
};

// POST /api/training/certificates  — generate certificates for a course
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { course_id, attendee_ids } = body;

  if (!course_id) return Response.json({ ok: false, error: "Missing course_id" }, { status: 400 });

  // Get course info for cert data
  const course = await ctx.env.HR_DB.prepare(
    "SELECT * FROM training_courses WHERE id = ?"
  ).bind(course_id).first<{
    id: number; course_code: string; course: string; course_date: string;
    start_time: string; end_time: string; trainer: string;
  }>();
  if (!course) return Response.json({ ok: false, error: "ไม่พบหลักสูตร" }, { status: 404 });

  // Calculate hours
  let hours = 0;
  if (course.start_time && course.end_time) {
    const [sh, sm] = course.start_time.split(":").map(Number);
    const [eh, em] = course.end_time.split(":").map(Number);
    hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }

  // Get attendees to certify
  let attendees;
  if (Array.isArray(attendee_ids) && attendee_ids.length > 0) {
    const placeholders = attendee_ids.map(() => "?").join(",");
    attendees = await ctx.env.HR_DB.prepare(
      `SELECT * FROM training_attendees WHERE course_id = ? AND id IN (${placeholders}) AND attendance_status = 'completed'`
    ).bind(course_id, ...attendee_ids).all();
  } else {
    attendees = await ctx.env.HR_DB.prepare(
      "SELECT * FROM training_attendees WHERE course_id = ? AND attendance_status = 'completed'"
    ).bind(course_id).all();
  }

  // Build cert_id prefix: CERT-YYYY-COURSECODE-NNNN
  const yearStr = course.course_date ? course.course_date.slice(0, 4) : new Date().getFullYear().toString();
  const codeStr = (course.course_code ?? String(course.id)).replace(/[^A-Z0-9]/gi, "").toUpperCase();

  const countRow = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM training_certificates WHERE course_id = ?"
  ).bind(course_id).first<{ n: number }>();
  let runNo = (countRow?.n ?? 0) + 1;

  const created: { cert_id: string; attendee_id: number }[] = [];

  for (const att of attendees.results as {
    id: number; name: string; position: string | null; department: string | null;
  }[]) {
    // Skip if cert already exists for this attendee
    const existing = await ctx.env.HR_DB.prepare(
      "SELECT id FROM training_certificates WHERE course_id = ? AND attendee_id = ?"
    ).bind(course_id, att.id).first();
    if (existing) continue;

    const cert_id  = `CERT-${yearStr}-${codeStr}-${String(runNo).padStart(4, "0")}`;
    const qr_token = crypto.randomUUID();

    await ctx.env.HR_DB.prepare(`
      INSERT INTO training_certificates
        (cert_id, course_id, attendee_id, full_name, position, department, hours, course_date, status, qr_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?)
    `).bind(cert_id, course_id, att.id, att.name, att.position ?? null, att.department ?? null,
      hours, course.course_date ?? null, qr_token).run();

    created.push({ cert_id, attendee_id: att.id });
    runNo++;
  }

  return Response.json({ ok: true, created: created.length, details: created }, { status: 201 });
};
