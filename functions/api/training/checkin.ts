import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// POST /api/training/checkin  — QR scan check-in (requires login)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { qr_token, name, emp_code, department, position, phone } = body;

  if (!qr_token) return Response.json({ ok: false, error: "Missing qr_token" }, { status: 400 });

  // Find course by QR token
  const course = await ctx.env.HR_DB.prepare(
    "SELECT id, course, reg_open, start_time FROM training_courses WHERE qr_token = ?"
  ).bind(qr_token).first<{ id: number; course: string; reg_open: number; start_time: string | null }>();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  if (!course.reg_open) return Response.json({ ok: false, error: "หลักสูตรนี้ปิดรับสมัครแล้ว" }, { status: 400 });

  // Check if already registered
  const existing = await ctx.env.HR_DB.prepare(
    "SELECT id, attendance_status FROM training_attendees WHERE course_id = ? AND name = ?"
  ).bind(course.id, name ?? user.full_name).first<{ id: number; attendance_status: string }>();

  const now = new Date().toISOString();
  const userAgent = ctx.request.headers.get("user-agent") ?? "unknown";

  // Determine if late (compare current time vs start_time)
  let attendanceStatus = "checked_in";
  if (course.start_time) {
    const [h, m] = course.start_time.split(":").map(Number);
    const nowDate   = new Date();
    const startDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), h, m);
    if (nowDate > startDate) attendanceStatus = "late";
  }

  if (existing) {
    if (existing.attendance_status === "checked_in" || existing.attendance_status === "late") {
      return Response.json({ ok: true, message: "เช็คชื่อแล้ว", course: course.course, alreadyDone: true });
    }
    await ctx.env.HR_DB.prepare(
      "UPDATE training_attendees SET attendance_status=?, checkin_time=?, device_info=? WHERE id=?"
    ).bind(attendanceStatus, now, userAgent.slice(0, 200), existing.id).run();
    return Response.json({ ok: true, message: "เช็คชื่อสำเร็จ", course: course.course });
  }

  // New registration via QR
  const checkinName = (name as string) || user.full_name;
  await ctx.env.HR_DB.prepare(`
    INSERT INTO training_attendees
      (course_id, emp_code, name, department, position, phone, reg_method, attendance_status, checkin_time, device_info)
    VALUES (?, ?, ?, ?, ?, ?, 'qr', ?, ?, ?)
  `).bind(
    course.id,
    emp_code ?? null,
    checkinName,
    department ?? null,
    position   ?? null,
    phone      ?? null,
    attendanceStatus,
    now,
    userAgent.slice(0, 200)
  ).run();

  return Response.json({ ok: true, message: "ลงทะเบียนและเช็คชื่อสำเร็จ", course: course.course });
};

// GET /api/training/checkin?token=X  — get course info by QR token (for check-in page)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url   = new URL(ctx.request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return Response.json({ ok: false, error: "Missing token" }, { status: 400 });

  const course = await ctx.env.HR_DB.prepare(
    "SELECT id, course_code, course, course_type, trainer, course_date, start_time, end_time, location, reg_open FROM training_courses WHERE qr_token = ?"
  ).bind(token).first();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  return Response.json({ ok: true, course });
};
