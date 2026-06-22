import type { Env } from "../../lib/types";

interface CourseRow {
  id: number; course_code: string; course: string; course_type: string;
  trainer: string | null; course_date: string | null; start_time: string | null;
  end_time: string | null; location: string | null; reg_open: number;
  status: string; is_cancelled: number;
}

// GET /api/training/checkin?token=xxx  — public, get course info
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url   = new URL(ctx.request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return Response.json({ ok: false, error: "Missing token" }, { status: 400 });

  const course = await ctx.env.HR_DB.prepare(`
    SELECT id, course_code, course, course_type, trainer, course_date,
           start_time, end_time, location, reg_open, status,
           COALESCE(is_cancelled, 0) AS is_cancelled
    FROM training_courses WHERE qr_token = ?
  `).bind(token).first<CourseRow>();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  if (course.is_cancelled) return Response.json({ ok: false, error: "หลักสูตรนี้ถูกยกเลิกแล้ว" }, { status: 410 });

  const count = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM training_attendees WHERE course_id = ?"
  ).bind(course.id).first<{ n: number }>();

  return Response.json({ ok: true, course, registered: count?.n ?? 0 });
};

// POST /api/training/checkin  — public QR registration (no login required)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json() as {
    token: string; first_name: string; last_name: string;
    position?: string; participant_type: "attendee" | "trainer";
  };

  const { token, first_name, last_name, position, participant_type } = body;

  if (!token || !first_name?.trim() || !last_name?.trim() || !participant_type) {
    return Response.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  if (!["attendee", "trainer"].includes(participant_type)) {
    return Response.json({ ok: false, error: "participant_type ไม่ถูกต้อง" }, { status: 400 });
  }

  const course = await ctx.env.HR_DB.prepare(
    "SELECT id, reg_open, status, COALESCE(is_cancelled, 0) AS is_cancelled FROM training_courses WHERE qr_token = ?"
  ).bind(token).first<{ id: number; reg_open: number; status: string; is_cancelled: number }>();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  if (course.is_cancelled) return Response.json({ ok: false, error: "หลักสูตรนี้ถูกยกเลิกแล้ว" }, { status: 410 });
  if (!course.reg_open) return Response.json({ ok: false, error: "ขณะนี้ยังไม่เปิดรับลงทะเบียน กรุณาติดต่อเจ้าหน้าที่ HR" }, { status: 403 });

  const fullName = `${first_name.trim()} ${last_name.trim()}`;

  const existing = await ctx.env.HR_DB.prepare(
    "SELECT id, participant_type FROM training_attendees WHERE course_id = ? AND name = ?"
  ).bind(course.id, fullName).first<{ id: number; participant_type: string }>();

  if (existing) {
    return Response.json({ ok: true, duplicate: true, attendee_id: existing.id, participant_type: existing.participant_type });
  }

  const ua = ctx.request.headers.get("user-agent") ?? "";
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Real-IP") ?? null;

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO training_attendees
      (course_id, name, position, reg_method, attendance_status,
       checkin_time, device_info, ip_address, participant_type)
    VALUES (?, ?, ?, 'qr', 'checked_in', datetime('now'), ?, ?, ?)
  `).bind(
    course.id, fullName, position?.trim() ?? null,
    ua.slice(0, 300), ip, participant_type
  ).run();

  return Response.json({
    ok: true, duplicate: false,
    attendee_id: result.meta.last_row_id,
    participant_type,
  }, { status: 201 });
};
