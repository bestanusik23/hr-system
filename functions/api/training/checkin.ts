import type { Env } from "../../lib/types";
import { bangkokNow, isLateFor, parseHm, sessionAt, syncAttendeeStatus, type Session } from "../../lib/trainingSessions";

interface CourseRow {
  id: number; course_code: string; course: string; course_type: string;
  trainer: string | null; course_date: string | null; start_time: string | null;
  end_time: string | null; location: string | null; reg_open: number;
  status: string; is_cancelled: number; checkin_sessions: number; pm_start_time: string | null;
}

// GET /api/training/checkin?token=xxx  — public, get course info
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url   = new URL(ctx.request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return Response.json({ ok: false, error: "Missing token" }, { status: 400 });

  const course = await ctx.env.HR_DB.prepare(`
    SELECT id, course_code, course, course_type, trainer, course_date,
           start_time, end_time, location, reg_open, status,
           COALESCE(is_cancelled, 0) AS is_cancelled,
           COALESCE(checkin_sessions, 1) AS checkin_sessions, pm_start_time
    FROM training_courses WHERE qr_token = ?
  `).bind(token).first<CourseRow>();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  if (course.is_cancelled) return Response.json({ ok: false, error: "หลักสูตรนี้ถูกยกเลิกแล้ว" }, { status: 410 });

  const count = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM training_attendees WHERE course_id = ?"
  ).bind(course.id).first<{ n: number }>();

  const now = bangkokNow();
  return Response.json({
    ok: true, course, registered: count?.n ?? 0,
    today: now.date, session_now: sessionAt(now.minutes),
  });
};

// POST /api/training/checkin  — public QR registration + pre-registration support
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json() as {
    token: string; first_name: string; last_name: string;
    position?: string; department?: string; participant_type: "attendee" | "trainer"; emp_code?: string;
  };

  const { token, first_name, last_name, position, department, participant_type, emp_code } = body;

  if (!token || !first_name?.trim() || !last_name?.trim() || !participant_type) {
    return Response.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  if (!["attendee", "trainer"].includes(participant_type)) {
    return Response.json({ ok: false, error: "participant_type ไม่ถูกต้อง" }, { status: 400 });
  }

  const course = await ctx.env.HR_DB.prepare(
    `SELECT id, reg_open, status, course_date, start_time, pm_start_time,
            COALESCE(checkin_sessions, 1) AS checkin_sessions, COALESCE(is_cancelled, 0) AS is_cancelled
       FROM training_courses WHERE qr_token = ?`
  ).bind(token).first<{ id: number; reg_open: number; status: string; course_date: string | null; start_time: string | null; pm_start_time: string | null; checkin_sessions: number; is_cancelled: number }>();

  if (!course) return Response.json({ ok: false, error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  if (course.is_cancelled) return Response.json({ ok: false, error: "หลักสูตรนี้ถูกยกเลิกแล้ว" }, { status: 410 });
  if (!course.reg_open) return Response.json({ ok: false, error: "ขณะนี้ยังไม่เปิดรับลงทะเบียน กรุณาติดต่อเจ้าหน้าที่ HR" }, { status: 403 });

  const now      = bangkokNow();
  const isPreReg = course.course_date ? course.course_date > now.date : false;
  const twoSessions = course.checkin_sessions === 2;

  // หลักสูตรเช็คชื่อ 2 รอบ: เช็คได้เฉพาะวันอบรม (หลังวันอบรมไม่รับเช็คชื่อ — ให้ HR บันทึกให้แทน)
  if (twoSessions && course.course_date && course.course_date < now.date) {
    return Response.json({ ok: false, error: "หมดเวลาเช็คชื่อแล้ว (เลยวันอบรม) กรุณาติดต่อเจ้าหน้าที่ HR" }, { status: 410 });
  }

  const fullName = `${first_name.trim()} ${last_name.trim()}`;
  const ua = ctx.request.headers.get("user-agent") ?? "";
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Real-IP") ?? null;
  const code = emp_code?.trim() || null;

  // จับคู่ด้วยรหัสพนักงานก่อน (กันชื่อสะกด/คำนำหน้าไม่ตรงกับตอนลงทะเบียนล่วงหน้า) แล้วค่อยจับคู่ด้วยชื่อ
  const existing = await ctx.env.HR_DB.prepare(
    `SELECT id, participant_type, attendance_status FROM training_attendees
      WHERE course_id = ? AND (name = ? OR (? IS NOT NULL AND emp_code = ?))
      ORDER BY (name = ?) DESC, id LIMIT 1`
  ).bind(course.id, fullName, code, code, fullName).first<{ id: number; participant_type: string; attendance_status: string }>();

  // ---- เช็คชื่อ 2 รอบ (เช้า/บ่าย) ----
  if (twoSessions) {
    let attendeeId = existing?.id ?? 0;
    let participantType = existing?.participant_type ?? participant_type;

    if (!existing) {
      const ins = await ctx.env.HR_DB.prepare(`
        INSERT INTO training_attendees
          (course_id, emp_code, name, department, position, reg_method, attendance_status,
           device_info, ip_address, participant_type)
        VALUES (?, ?, ?, ?, ?, 'qr', 'registered', ?, ?, ?)
      `).bind(course.id, code, fullName, department?.trim() || null, position?.trim() ?? null,
              ua.slice(0, 300), ip, participant_type).run();
      attendeeId = Number(ins.meta.last_row_id);
      participantType = participant_type;
    }

    if (isPreReg) {
      return Response.json({
        ok: true, duplicate: !!existing, prereg: !existing, attendee_id: attendeeId,
        participant_type: participantType, course_date: course.course_date, two_sessions: true,
      }, { status: existing ? 200 : 201 });
    }

    const session: Session = sessionAt(now.minutes);
    const late = isLateFor(session, now.minutes, course.start_time, course.pm_start_time);
    const ins = await ctx.env.HR_DB.prepare(
      "INSERT OR IGNORE INTO training_checkins (course_id, attendee_id, session, is_late, source) VALUES (?,?,?,?, 'qr')"
    ).bind(course.id, attendeeId, session, late ? 1 : 0).run();
    const already = (ins.meta.changes ?? 0) === 0;
    await syncAttendeeStatus(ctx.env.HR_DB, attendeeId);

    const done = (await ctx.env.HR_DB.prepare(
      "SELECT session FROM training_checkins WHERE attendee_id = ? ORDER BY session"
    ).bind(attendeeId).all<{ session: Session }>()).results?.map(r => r.session) ?? [];

    return Response.json({
      ok: true, two_sessions: true, session, already, is_late: late, sessions_done: done,
      attendee_id: attendeeId, participant_type: participantType, course_date: course.course_date,
    }, { status: already ? 200 : 201 });
  }

  // ---- เช็คชื่อครั้งเดียว (พฤติกรรมเดิม) ----
  const startMin = parseHm(course.start_time);
  const lateNow  = startMin !== null && now.minutes > startMin;

  if (existing) {
    // Pre-registered → scan again on training day → auto check-in
    if (!isPreReg && existing.attendance_status === "registered") {
      const newStatus = lateNow ? "late" : "checked_in";
      await ctx.env.HR_DB.prepare(
        "UPDATE training_attendees SET attendance_status=?, checkin_time=datetime('now'), device_info=?, ip_address=? WHERE id=?"
      ).bind(newStatus, ua.slice(0, 300), ip, existing.id).run();
      return Response.json({ ok: true, updated: true, attendee_id: existing.id, participant_type: existing.participant_type });
    }
    return Response.json({ ok: true, duplicate: true, attendee_id: existing.id, participant_type: existing.participant_type, attendance_status: existing.attendance_status });
  }

  let attendanceStatus = "registered";
  if (!isPreReg) attendanceStatus = lateNow ? "late" : "checked_in";

  let result;
  try {
    result = await ctx.env.HR_DB.prepare(`
      INSERT INTO training_attendees
        (course_id, emp_code, name, department, position, reg_method, attendance_status,
         checkin_time, device_info, ip_address, participant_type)
      VALUES (?, ?, ?, ?, ?, 'qr', ?, ${isPreReg ? "NULL" : "datetime('now')"}, ?, ?, ?)
    `).bind(
      course.id, code, fullName,
      department?.trim() || null, position?.trim() ?? null,
      attendanceStatus, ua.slice(0, 300), ip, participant_type
    ).run();
  } catch {
    // fallback without department/emp_code for older schemas
    result = await ctx.env.HR_DB.prepare(`
      INSERT INTO training_attendees
        (course_id, name, position, reg_method, attendance_status,
         checkin_time, device_info, ip_address, participant_type)
      VALUES (?, ?, ?, 'qr', ?, ${isPreReg ? "NULL" : "datetime('now')"}, ?, ?, ?)
    `).bind(
      course.id, fullName, position?.trim() ?? null,
      attendanceStatus, ua.slice(0, 300), ip, participant_type
    ).run();
  }

  return Response.json({
    ok: true, duplicate: false, prereg: isPreReg,
    attendee_id: result.meta.last_row_id,
    participant_type,
    course_date: course.course_date,
  }, { status: 201 });
};
