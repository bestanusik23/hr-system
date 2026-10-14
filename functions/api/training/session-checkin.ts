import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { syncAttendeeStatus } from "../../lib/trainingSessions";

// PUT /api/training/session-checkin  (hr/admin)
//   body: { attendee_id: number, session: "am" | "pm", present: boolean }
// HR บันทึก/ยกเลิกการเช็คชื่อรายรอบด้วยมือ (เช่น มือถือเสีย สแกนไม่ได้)
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as { attendee_id?: number; session?: string; present?: boolean };
  const attendeeId = Number(body.attendee_id);
  if (!Number.isInteger(attendeeId) || !["am", "pm"].includes(body.session ?? ""))
    return Response.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const att = await ctx.env.HR_DB.prepare(
    `SELECT ta.id, ta.course_id, COALESCE(tc.checkin_sessions, 1) AS ns
       FROM training_attendees ta JOIN training_courses tc ON tc.id = ta.course_id WHERE ta.id = ?`
  ).bind(attendeeId).first<{ id: number; course_id: number; ns: number }>();
  if (!att) return Response.json({ ok: false, error: "ไม่พบผู้เข้าอบรม" }, { status: 404 });
  if (att.ns !== 2) return Response.json({ ok: false, error: "หลักสูตรนี้ไม่ได้ตั้งเช็คชื่อ 2 รอบ" }, { status: 400 });

  if (body.present) {
    await ctx.env.HR_DB.prepare(
      "INSERT OR IGNORE INTO training_checkins (course_id, attendee_id, session, source) VALUES (?,?,?,'manual')"
    ).bind(att.course_id, attendeeId, body.session).run();
  } else {
    await ctx.env.HR_DB.prepare("DELETE FROM training_checkins WHERE attendee_id = ? AND session = ?")
      .bind(attendeeId, body.session).run();
  }
  await syncAttendeeStatus(ctx.env.HR_DB, attendeeId);

  return Response.json({ ok: true });
};
