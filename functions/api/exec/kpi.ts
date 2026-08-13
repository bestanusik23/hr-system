import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { LICENSED_POSITION_FILTER } from "../../lib/licensedPositions";
import { ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END } from "../../lib/assumedCompliance";

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

  // Manual backfill per KPI card, for this exact period — see exec_kpi_overrides.
  // The frontend shows these instead of the live-computed figures when present.
  const overrideRows = await db.prepare(
    "SELECT kpi_key, pct, detail FROM exec_kpi_overrides WHERE period_type = ? AND period_value = ?"
  ).bind(period, value).all<{ kpi_key: string; pct: number; detail: string }>();
  const overrides: Record<string, { pct: number; detail: string }> = {};
  for (const r of overrideRows.results ?? []) overrides[r.kpi_key] = { pct: r.pct, detail: r.detail };

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
  // Hires who started within the assumed-compliant window (see assumedCompliance.ts) count as
  // oriented automatically, matching the ISO KPI grid, so the two sections never disagree.
  const oriented = await db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS n
    FROM employees e
    WHERE e.start_date >= ? AND e.start_date <= ?
      AND (
        (e.start_date >= ? AND e.start_date <= ?)
        OR EXISTS (
          SELECT 1 FROM training_attendees ta JOIN training_courses tc ON tc.id = ta.course_id
          WHERE ((ta.emp_code IS NOT NULL AND ta.emp_code = e.emp_code) OR (ta.emp_code IS NULL AND TRIM(ta.name) = TRIM(e.full_name)))
            AND tc.course LIKE '%ปฐมนิเทศ%'
            AND COALESCE(tc.is_cancelled,0) = 0
            AND (ta.attendance_status = 'completed' OR ta.result = 'ผ่าน')
        )
      )
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const orientedN  = oriented?.n ?? 0;
  const orientationPct = newHireN > 0 ? round1(orientedN / newHireN * 100) : null;

  // 4) ร้อยละความพึงพอใจของผู้ที่ได้รับการอบรม — survey responses submitted in period (q1-q5, 1-4 scale → 0-100%)
  const survey = await db.prepare(
    "SELECT ROUND(AVG((q1+q2+q3+q4+q5)*5.0),1) AS pct, COUNT(*) AS n FROM training_surveys WHERE date(submitted_at) >= ? AND date(submitted_at) <= ?"
  ).bind(pStart, pEnd).first<{ pct: number | null; n: number }>();
  const satisfactionPct = survey?.pct ?? null;
  const satisfactionN   = survey?.n ?? 0;

  // 5) ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลการปฏิบัติงาน — final (round 90) probation evaluations decided in period.
  // Hires who started within the assumed-compliant window count as passed automatically (matching the
  // ISO "Competency" KPI), attributed to whichever period their start_date falls in; their real
  // evaluations (if any) are excluded from the live count below so they aren't counted twice.
  const autoProbation = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ? AND start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const autoProbationN = autoProbation?.n ?? 0;
  const evalTotal = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      AND NOT (e.start_date >= ? AND e.start_date <= ?)
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const evalPassed = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND ev.decision = 'บรรจุเป็นพนักงานประจำ'
      AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      AND NOT (e.start_date >= ? AND e.start_date <= ?)
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const evalTotalN  = autoProbationN + (evalTotal?.n ?? 0);
  const evalPassedN = autoProbationN + (evalPassed?.n ?? 0);
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

  // 7) ร้อยละของบุคลากรที่มีใบประกอบวิชาชีพถูกต้อง — of staff in positions that
  // require one (nurses/pharmacists/med techs/radiologic techs/medical
  // physicists/doctors, see licensedPositions.ts), how many have a
  // license_expiry that's still valid as of the end of this period.
  // Employees HR has explicitly excluded (iso_kpi_license_exclusions — the
  // position filter is a heuristic and occasionally catches someone HR
  // doesn't want tracked here) are dropped from both sides.
  const NOT_EXCLUDED = "id NOT IN (SELECT employee_id FROM iso_kpi_license_exclusions)";
  const licenseTotal = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned' AND ${LICENSED_POSITION_FILTER} AND ${NOT_EXCLUDED}`
  ).first<{ n: number }>();
  const licenseValid = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned' AND ${LICENSED_POSITION_FILTER} AND ${NOT_EXCLUDED} AND license_expiry IS NOT NULL AND license_expiry >= ?`
  ).bind(pEnd).first<{ n: number }>();
  const licenseTotalN = licenseTotal?.n ?? 0;
  const licenseValidN = licenseValid?.n ?? 0;
  const licensePct = licenseTotalN > 0 ? round1(licenseValidN / licenseTotalN * 100) : null;

  // Lists — new hires / resignations in period, for the printable monthly report
  const newHireList = await db.prepare(
    "SELECT full_name, position, start_date FROM employees WHERE start_date >= ? AND start_date <= ? ORDER BY start_date ASC"
  ).bind(pStart, pEnd).all<{ full_name: string; position: string | null; start_date: string }>();
  const resignList = await db.prepare(
    "SELECT full_name, position, resign_date, resign_reason FROM employees WHERE resign_date >= ? AND resign_date <= ? ORDER BY resign_date ASC"
  ).bind(pStart, pEnd).all<{ full_name: string; position: string | null; resign_date: string; resign_reason: string | null }>();

  // Drill-down lists so HR can see exactly who/what feeds each KPI card and go fix it.
  const evalCoverageList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.start_date,
      EXISTS(SELECT 1 FROM evaluations ev WHERE ev.employee_id = e.id) AS has_eval
    FROM employees e WHERE e.start_date >= ? AND e.start_date <= ? ORDER BY e.start_date ASC
  `).bind(pStart, pEnd).all<{ id: number; full_name: string; position: string | null; start_date: string; has_eval: number }>();

  const orientationList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.start_date,
      (
        (e.start_date >= ? AND e.start_date <= ?)
        OR EXISTS(
          SELECT 1 FROM training_attendees ta JOIN training_courses tc ON tc.id = ta.course_id
          WHERE ((ta.emp_code IS NOT NULL AND ta.emp_code = e.emp_code) OR (ta.emp_code IS NULL AND TRIM(ta.name) = TRIM(e.full_name)))
            AND tc.course LIKE '%ปฐมนิเทศ%' AND COALESCE(tc.is_cancelled,0) = 0
            AND (ta.attendance_status = 'completed' OR ta.result = 'ผ่าน')
        )
      ) AS oriented
    FROM employees e WHERE e.start_date >= ? AND e.start_date <= ? ORDER BY e.start_date ASC
  `).bind(ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END, pStart, pEnd).all<{ id: number; full_name: string; position: string | null; start_date: string; oriented: number }>();

  const satisfactionList = await db.prepare(`
    SELECT tc.id AS course_id, tc.course, tc.course_date,
      ROUND(AVG((ts.q1+ts.q2+ts.q3+ts.q4+ts.q5)*5.0),1) AS avg_pct, COUNT(*) AS n
    FROM training_surveys ts JOIN training_courses tc ON tc.id = ts.course_id
    WHERE date(ts.submitted_at) >= ? AND date(ts.submitted_at) <= ?
    GROUP BY tc.id ORDER BY tc.course_date DESC
  `).bind(pStart, pEnd).all<{ course_id: number; course: string; course_date: string | null; avg_pct: number; n: number }>();

  const probationPassList = await db.prepare(`
    SELECT ev.id AS eval_id, e.id AS employee_id, e.full_name, e.position, ev.decision, ev.updated_at
    FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      AND NOT (e.start_date >= ? AND e.start_date <= ?)
    ORDER BY ev.updated_at ASC
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).all<{ eval_id: number; employee_id: number; full_name: string; position: string | null; decision: string | null; updated_at: string }>();
  const assumedProbationList = await db.prepare(`
    SELECT id AS employee_id, full_name, position, start_date
    FROM employees WHERE start_date >= ? AND start_date <= ? AND start_date >= ? AND start_date <= ?
    ORDER BY start_date ASC
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).all<{ employee_id: number; full_name: string; position: string | null; start_date: string }>();

  const trainingPlanList = await db.prepare(`
    SELECT id, course, course_date, status, COALESCE(is_cancelled,0) AS is_cancelled
    FROM training_courses WHERE course_date >= ? AND course_date <= ? ORDER BY course_date ASC
  `).bind(pStart, pEnd).all<{ id: number; course: string; course_date: string | null; status: string; is_cancelled: number }>();

  // Shows everyone the filter matched, including exclusions (flagged, not
  // dropped) so HR can review and toggle them back in from this same list.
  const licenseList = await db.prepare(`
    SELECT id, full_name, position, license_number, license_expiry,
      (license_expiry IS NOT NULL AND license_expiry >= ?) AS valid,
      (id IN (SELECT employee_id FROM iso_kpi_license_exclusions)) AS excluded
    FROM employees WHERE emp_status != 'resigned' AND ${LICENSED_POSITION_FILTER}
    ORDER BY excluded ASC, valid ASC, license_expiry ASC
  `).bind(pEnd).all<{ id: number; full_name: string; position: string | null; license_number: string | null; license_expiry: string | null; valid: number; excluded: number }>();

  // Merge real evaluation rows with virtual "assumed compliant" rows (no real evaluation exists yet,
  // or it's being overridden by the Jan-Jun 2569 policy) so the drill-down list total matches evalTotalN.
  const ASSUMED_PROBATION_LABEL = "ถือว่าผ่าน (ข้อมูลย้อนหลัง ม.ค.-มิ.ย. 69)";
  const probationPassListMerged = [
    ...(probationPassList.results ?? []),
    ...(assumedProbationList.results ?? []).map(r => ({
      eval_id: -r.employee_id, employee_id: r.employee_id, full_name: r.full_name,
      position: r.position, decision: ASSUMED_PROBATION_LABEL, updated_at: r.start_date,
    })),
  ].sort((a, b) => a.updated_at.localeCompare(b.updated_at));

  return Response.json({
    ok: true,
    period_label: label,
    period_type: period,
    period_value: value,
    overrides,
    turnover:       { pct: turnoverPct, resigned: resigned?.n ?? 0, headcount: hcNow },
    eval_coverage:  { pct: evalCoveragePct, received: evalReceivedN, total: newHireN },
    orientation:    { pct: orientationPct, passed: orientedN, total: newHireN },
    satisfaction:   { pct: satisfactionPct, responses: satisfactionN },
    probation_pass: { pct: probationPassPct, passed: evalPassedN, total: evalTotalN },
    training_plan:  { pct: trainingPlanPct, actual: trainingActualN, cancelled: trainingCancelledN, total: trainingPlannedN },
    license:        { pct: licensePct, valid: licenseValidN, total: licenseTotalN },
    new_hire_list: newHireList.results ?? [],
    resign_list: resignList.results ?? [],
    eval_coverage_list: (evalCoverageList.results ?? []).map(r => ({ ...r, has_eval: !!r.has_eval })),
    orientation_list: (orientationList.results ?? []).map(r => ({ ...r, oriented: !!r.oriented })),
    satisfaction_list: satisfactionList.results ?? [],
    probation_pass_list: probationPassListMerged,
    training_plan_list: (trainingPlanList.results ?? []).map(r => ({ ...r, is_cancelled: !!r.is_cancelled })),
    license_list: (licenseList.results ?? []).map(r => ({ ...r, valid: !!r.valid, excluded: !!r.excluded })),
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
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  // 26th cut-off, matching /api/manpower/summary and /api/manpower/snapshot: the
  // "July" period runs 26 June – 25 July, not the plain calendar month.
  const pStartDate = new Date(y, m - 2, 26);
  const pEndDate   = new Date(y, m - 1, 25);
  return {
    pStart: pStartDate.toISOString().slice(0, 10),
    pEnd:   pEndDate.toISOString().slice(0, 10),
    label:  `${MT[m - 1]} ${y + 543}`,
  };
}
