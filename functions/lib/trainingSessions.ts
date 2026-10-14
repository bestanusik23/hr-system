import type { Env } from "./types";

export type Session = "am" | "pm";

const BANGKOK_OFFSET_MS = 7 * 3600_000;
// ก่อน 12:30 น. นับเป็นรอบเช้า หลังจากนั้นเป็นรอบบ่าย
const PM_CUTOFF_MIN = 12 * 60 + 30;
const DEFAULT_PM_START_MIN = 13 * 60;

/** วันที่ (YYYY-MM-DD) และนาทีนับจากเที่ยงคืน ตามเวลาประเทศไทย — Workers รันเป็น UTC จึงต้องบวก 7 ชม. เอง */
export function bangkokNow(): { date: string; minutes: number } {
  const t = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** รับ "09:00", "09.00", "9.00 น." → 540 ; อ่านไม่ได้คืน null */
export function parseHm(s: string | null | undefined): number | null {
  const m = /(\d{1,2})\s*[:.]\s*(\d{2})/.exec(s ?? "");
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

export function sessionAt(minutes: number): Session {
  return minutes < PM_CUTOFF_MIN ? "am" : "pm";
}

export function isLateFor(session: Session, minutes: number, startTime: string | null, pmStartTime: string | null): boolean {
  const start = session === "am" ? parseHm(startTime) : (parseHm(pmStartTime) ?? DEFAULT_PM_START_MIN);
  return start !== null && minutes > start;
}

/**
 * หลักสูตรเช็คชื่อ 2 รอบ: ปรับ attendance_status ของผู้เข้าอบรมให้ตรงกับรอบที่เช็คจริง
 *  - เช็คอย่างน้อย 1 รอบ  → checked_in / late (ตามรอบแรกที่เช็ค)
 *  - ครบทั้ง 2 รอบ + ทำแบบประเมินแล้ว → completed (เงื่อนไขออกใบประกาศ)
 *  - ลดรอบจนไม่ครบ → completed กลับเป็น checked_in ; ไม่เหลือรอบเลย → registered
 * หลักสูตรเช็คครั้งเดียวไม่ถูกแตะ
 */
export async function syncAttendeeStatus(db: Env["HR_DB"], attendeeId: number): Promise<void> {
  const att = await db.prepare(
    `SELECT ta.id, ta.attendance_status AS st, tc.checkin_sessions AS ns
       FROM training_attendees ta JOIN training_courses tc ON tc.id = ta.course_id
      WHERE ta.id = ?`
  ).bind(attendeeId).first<{ id: number; st: string; ns: number }>();
  if (!att || att.ns !== 2) return;

  const rows = (await db.prepare(
    "SELECT session, checked_at, is_late FROM training_checkins WHERE attendee_id = ? ORDER BY checked_at"
  ).bind(attendeeId).all<{ session: Session; checked_at: string; is_late: number }>()).results ?? [];

  if (rows.length === 0) {
    if (["checked_in", "late", "completed"].includes(att.st)) {
      await db.prepare("UPDATE training_attendees SET attendance_status='registered', checkin_time=NULL WHERE id=?").bind(attendeeId).run();
    }
    return;
  }

  const bothDone = rows.length >= 2;
  const surveyed = !!(await db.prepare("SELECT 1 AS x FROM training_surveys WHERE attendee_id = ? LIMIT 1").bind(attendeeId).first());
  const first = rows[0];
  const base = first.is_late ? "late" : "checked_in";

  let next = att.st;
  if (att.st === "registered" || att.st === "absent") next = base;
  else if (att.st === "completed" && !bothDone) next = base;
  if (bothDone && surveyed && (next === "checked_in" || next === "late")) next = "completed";

  if (next !== att.st || att.st === "registered") {
    await db.prepare(
      "UPDATE training_attendees SET attendance_status=?, checkin_time=COALESCE(checkin_time, ?) WHERE id=?"
    ).bind(next, first.checked_at, attendeeId).run();
  }
}

// ── จับคู่การสแกน QR กับรายชื่อที่ลงทะเบียนไว้ ──────────────────────────────
// รหัสพนักงานตรงกันก่อน แล้วค่อยเทียบชื่อโดยไม่สนคำนำหน้า/ช่องว่าง (ที่เก็บไว้มี "น.ส." กับ "นางสาว" ปนกัน)
const NAME_PREFIX_RE = /^(นางสาว|น\.\s*ส\.?|นส\.?|นาย|นาง|ทพญ\.?|ทพ\.?|ภกญ\.?|ภก\.?|พญ\.?|นพ\.?|ดร\.?|ผศ\.?|รศ\.?|คุณ)\s*/;

export function normalizeName(s: string): string {
  return s.normalize("NFC").replace(/[​-‍﻿]/g, "").trim().replace(NAME_PREFIX_RE, "").replace(/[\s.]+/g, "");
}

export interface RegisteredRow { id: number; name: string; emp_code: string | null; participant_type: string; attendance_status: string }

export async function findRegistered(db: Env["HR_DB"], courseId: number, fullName: string, empCode: string | null): Promise<RegisteredRow | null> {
  const rows = (await db.prepare(
    "SELECT id, name, emp_code, participant_type, attendance_status FROM training_attendees WHERE course_id = ? ORDER BY id"
  ).bind(courseId).all<RegisteredRow>()).results ?? [];
  if (empCode) {
    const byCode = rows.find(r => r.emp_code === empCode);
    if (byCode) return byCode;
  }
  const n = normalizeName(fullName);
  return n ? rows.find(r => normalizeName(r.name) === n) ?? null : null;
}
