import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/exec/kpi?period=month&value=2026-07   (or period=year&value=2026)
// Returns the 5 core HR KPIs for the selected period.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputy", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url    = new URL(ctx.request.url);
  const period = url.searchParams.get("period") === "year" ? "year" : "month";
  const value  = url.searchParams.get("value") ?? "";

  const bounds = periodBounds(period, value);
  if (!bounds) return Response.json({ ok: false, error: "ช่วงเวลาไม่ถูกต้อง" }, { status: 400 });
  const { pStart, pEnd, label } = bounds;

  const db = ctx.env.HR_DB;

  // 1) ร้อยละพนักงานลาออก — resigned in period / current total headcount (matches Manpower dashboard's formula)
  const resigned = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE resign_date >= ? AND resign_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const headcountNow = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned'"
  ).first<{ n: number }>();
  const hcNow = headcountNow?.n ?? 0;
  const turnoverPct = hcNow > 0 ? round1((resigned?.n ?? 0) / hcNow * 100) : 0;

  // 2) ร้อยละพนักงานใหม่ที่ได้รับการประเมิน — new hires in period with at least one evaluation record (any round/status)
  const newHires = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const newHireN = newHires?.n ?? 0;
  const evalReceived = await db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS n
    FROM employees e
    JOIN evaluations ev ON ev.employee_id = e.id
    WHERE e.start_date >= ? AND e.start_date <= ?
  `).bind(pStart, pEnd).first<{ n: number }>();
  const evalReceivedN   = evalReceived?.n ?? 0;
  const evalCoveragePct = newHireN > 0 ? round1(evalReceivedN / newHireN * 100) : null;

  // 3) ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ — new hires in period who completed a course named "ปฐมนิเทศ".
  // Match attendees by emp_code first (accurate), falling back to trimmed full-name — same pattern
  // already used in functions/api/training/registrations.ts — because training_attendees.employee_id
  // is never actually written by any insert/update path in the training module (confirmed dead column).
  const oriented = await db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS n
    FROM employees e
    JOIN training_attendees ta ON (
      (ta.emp_code IS NOT NULL AND ta.emp_code = e.emp_code)
      OR (ta.emp_code IS NULL AND TRIM(ta.name) = TRIM(e.full_name))
    )
    JOIN training_courses tc ON tc.id = ta.course_id
    WHERE e.start_date >= ? AND e.start_date <= ?
      AND tc.course LIKE '%ปฐมนิเทศ%'
      AND COALESCE(tc.is_cancelled,0) = 0
      AND (ta.attendance_status = 'completed' OR ta.result = 'ผ่าน')
  `).bind(pStart, pEnd).first<{ n: number }>();
  const orientedN  = oriented?.n ?? 0;
  const orientationPct = newHireN > 0 ? round1(orientedN / newHireN * 100) : null;

  // 4) ร้อยละความพึงพอใจของผู้ที่ได้รับการอบรม — survey responses submitted in period (q1-q5, 1-4 scale → 0-100%)
  const survey = await db.prepare(
    "SELECT ROUND(AVG((q1+q2+q3+q4+q5)*5.0),1) AS pct, COUNT(*) AS n FROM training_surveys WHERE date(submitted_at) >= ? AND date(submitted_at) <= ?"
  ).bind(pStart, pEnd).first<{ pct: number | null; n: number }>();
  const satisfactionPct = survey?.pct ?? null;
  const satisfactionN   = survey?.n ?? 0;

  // 5) ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลการปฏิบัติงาน — final (round 90) probation evaluations decided in period
  const evalTotal = await db.prepare(
    "SELECT COUNT(*) AS n FROM evaluations WHERE round = 90 AND status = 'approved' AND date(updated_at) >= ? AND date(updated_at) <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const evalPassed = await db.prepare(
    "SELECT COUNT(*) AS n FROM evaluations WHERE round = 90 AND status = 'approved' AND decision = 'บรรจุเป็นพนักงานประจำ' AND date(updated_at) >= ? AND date(updated_at) <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const evalTotalN  = evalTotal?.n ?? 0;
  const evalPassedN = evalPassed?.n ?? 0;
  const probationPassPct = evalTotalN > 0 ? round1(evalPassedN / evalTotalN * 100) : null;

  // 6) ร้อยละที่อบรมตามแผน — course-count based: หลักสูตรที่จัดจริง (status='done', not cancelled)
  // vs. หลักสูตรที่วางแผนไว้ทั้งหมดในช่วงนี้ (every course row for the period, cancelled or not —
  // a cancellation counts against plan adherence instead of being silently dropped from both sides).
  const trainingCounts = await db.prepare(`
    SELECT
      COUNT(*) AS planned_total,
      SUM(CASE WHEN COALESCE(is_cancelled,0)=0 AND status='done' THEN 1 ELSE 0 END) AS actual_done,
      SUM(CASE WHEN COALESCE(is_cancelled,0)=1 THEN 1 ELSE 0 END) AS cancelled
    FROM training_courses
    WHERE course_date >= ? AND course_date <= ?
  `).bind(pStart, pEnd).first<{ planned_total: number; actual_done: number; cancelled: number }>();
  const trainingPlannedN   = trainingCounts?.planned_total ?? 0;
  const trainingActualN    = trainingCounts?.actual_done ?? 0;
  const trainingCancelledN = trainingCounts?.cancelled ?? 0;
  const trainingPlanPct    = trainingPlannedN > 0 ? round1(trainingActualN / trainingPlannedN * 100) : null;

  // Lists — new hires / resignations in period, for the printable monthly report
  const newHireList = await db.prepare(
    "SELECT full_name, position, start_date FROM employees WHERE start_date >= ? AND start_date <= ? ORDER BY start_date ASC"
  ).bind(pStart, pEnd).all<{ full_name: string; position: string | null; start_date: string }>();
  const resignList = await db.prepare(
    "SELECT full_name, position, resign_date, resign_reason FROM employees WHERE resign_date >= ? AND resign_date <= ? ORDER BY resign_date ASC"
  ).bind(pStart, pEnd).all<{ full_name: string; position: string | null; resign_date: string; resign_reason: string | null }>();

  return Response.json({
    ok: true,
    period_label: label,
    turnover:       { pct: turnoverPct, resigned: resigned?.n ?? 0, headcount: hcNow },
    eval_coverage:  { pct: evalCoveragePct, received: evalReceivedN, total: newHireN },
    orientation:    { pct: orientationPct, passed: orientedN, total: newHireN },
    satisfaction:   { pct: satisfactionPct, responses: satisfactionN },
    probation_pass: { pct: probationPassPct, passed: evalPassedN, total: evalTotalN },
    training_plan:  { pct: trainingPlanPct, actual: trainingActualN, cancelled: trainingCancelledN, total: trainingPlannedN },
    new_hire_list: newHireList.results ?? [],
    resign_list: resignList.results ?? [],
  });
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function periodBounds(period: "month" | "year", value: string): { pStart: string; pEnd: string; label: string } | null {
  if (period === "year") {
    if (!/^\d{4}$/.test(value)) return null;
    return { pStart: `${value}-01-01`, pEnd: `${value}-12-31`, label: `ปี ${Number(value) + 543}` };
  }
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return {
    pStart: `${value}-01`,
    pEnd: `${value}-${String(lastDay).padStart(2, "0")}`,
    label: `${MT[m - 1]} ${y + 543}`,
  };
}
