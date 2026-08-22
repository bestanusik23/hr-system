import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { LICENSED_POSITION_FILTER } from "../../lib/licensedPositions";
import { ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END } from "../../lib/assumedCompliance";
import { monthBounds } from "../../lib/periodBounds";
import {
  computeOrientation, computeProbationPass, computeLicense, computeTrainingPlan,
  computeTurnover, computeEvalCoverage, computeSatisfaction, ISO_TO_EXEC_KPI_KEY,
} from "../../lib/hrKpiFormulas";

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

  // Manual backfill per KPI card. license/orientation/probation_pass/training_plan are
  // shared with the ISO KPI grid (FM-ISO-01 to 03), which stores its own overrides as
  // numerator/denominator keyed by (kpi, year BE, month) in iso_kpi_overrides — reading
  // from that same table here (translating the kpi_key and, for "month" periods, the
  // period value into year/month) means entering a backfill number in either dashboard
  // shows up in both, instead of the two keeping separate override rows that can disagree.
  // turnover/eval_coverage/satisfaction have no ISO equivalent and keep using their own
  // exec_kpi_overrides row (pct + free-text detail).
  const overrides: Record<string, { pct: number; detail: string; numerator?: number; denominator?: number }> = {};
  if (period === "month") {
    const [yCE, mm] = value.split("-").map(Number);
    const yearBE = yCE + 543;
    const isoOverrideRows = await db.prepare(
      "SELECT kpi_key, numerator, denominator FROM iso_kpi_overrides WHERE year = ? AND month = ?"
    ).bind(yearBE, mm).all<{ kpi_key: string; numerator: number; denominator: number }>();
    for (const r of isoOverrideRows.results ?? []) {
      const execKey = ISO_TO_EXEC_KPI_KEY[r.kpi_key];
      if (!execKey) continue;
      overrides[execKey] = {
        pct: r.denominator > 0 ? round1((r.numerator / r.denominator) * 100) : 0,
        detail: `${r.numerator}/${r.denominator} (กรอกเอง)`,
        numerator: r.numerator, denominator: r.denominator,
      };
    }
  }
  const execOnlyKeys = "('turnover','eval_coverage','satisfaction')";
  const overrideRows = await db.prepare(
    `SELECT kpi_key, pct, detail FROM exec_kpi_overrides WHERE period_type = ? AND period_value = ? AND kpi_key IN ${execOnlyKeys}`
  ).bind(period, value).all<{ kpi_key: string; pct: number; detail: string }>();
  for (const r of overrideRows.results ?? []) overrides[r.kpi_key] = { pct: r.pct, detail: r.detail };

  // 1) ร้อยละพนักงานลาออก — see hrKpiFormulas.ts.
  const turnoverResult = await computeTurnover(db, pStart, pEnd);
  const turnoverPct = turnoverResult.pct;

  // 2) ร้อยละพนักงานใหม่ที่ได้รับการประเมิน — see hrKpiFormulas.ts.
  const evalCoverageResult = await computeEvalCoverage(db, pStart, pEnd);
  const newHireN = evalCoverageResult.denominator;
  const evalReceivedN = evalCoverageResult.numerator;
  const evalCoveragePct = evalCoverageResult.pct;

  // 3) ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ — shared with the ISO "orientation" KPI; see hrKpiFormulas.ts.
  const orientationResult = await computeOrientation(db, pStart, pEnd);
  const orientedN = orientationResult.numerator;
  const orientationPct = orientationResult.pct;

  // 4) ร้อยละความพึงพอใจของผู้ที่ได้รับการอบรม — see hrKpiFormulas.ts.
  const satisfactionResult = await computeSatisfaction(db, pStart, pEnd);
  const satisfactionPct = satisfactionResult.pct;
  const satisfactionN   = satisfactionResult.numerator;

  // 5) ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลการปฏิบัติงาน — shared with the ISO "competency" KPI; see hrKpiFormulas.ts.
  const probationResult = await computeProbationPass(db, pStart, pEnd);
  const evalTotalN  = probationResult.denominator;
  const evalPassedN = probationResult.numerator;
  const probationPassPct = probationResult.pct;

  // 6) ร้อยละที่อบรมตามแผน — shared with the ISO "training" KPI; see hrKpiFormulas.ts.
  const trainingResult = await computeTrainingPlan(db, pStart, pEnd);
  const trainingPlannedN   = trainingResult.denominator;
  const trainingActualN    = trainingResult.numerator;
  const trainingCancelledN = trainingResult.cancelled;
  const trainingPlanPct    = trainingResult.pct;

  // 7) ร้อยละของบุคลากรที่มีใบประกอบวิชาชีพถูกต้อง — shared with the ISO "license" KPI; see hrKpiFormulas.ts.
  const licenseResult = await computeLicense(db, pStart, pEnd);
  const licenseTotalN = licenseResult.denominator;
  const licenseValidN = licenseResult.numerator;
  const licensePct = licenseResult.pct;

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
      ) AS oriented,
      (e.id IN (SELECT employee_id FROM iso_kpi_orientation_exclusions)) AS excluded
    FROM employees e
    WHERE e.start_date >= ? AND e.start_date <= ? AND e.emp_status != 'transferred'
    ORDER BY e.start_date ASC
  `).bind(ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END, pStart, pEnd).all<{ id: number; full_name: string; position: string | null; start_date: string; oriented: number; excluded: number }>();

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

  // Same "resolved by reschedule" rule as computeTrainingPlan (see hrKpiFormulas.ts) —
  // drop a cancelled row once its topic was actually held elsewhere in the same month,
  // so this list stays consistent with the % above it.
  const trainingPlanList = await db.prepare(`
    SELECT id, course, course_date, status, COALESCE(is_cancelled,0) AS is_cancelled
    FROM training_courses tc
    WHERE course_date >= ? AND course_date <= ? AND course NOT LIKE '%(สำเนา)%'
      AND NOT (
        COALESCE(is_cancelled,0)=1
        AND EXISTS (
          SELECT 1 FROM training_courses tc2
          WHERE TRIM(tc2.course) = TRIM(tc.course) AND tc2.id <> tc.id
            AND COALESCE(tc2.is_cancelled,0)=0 AND tc2.status = 'done'
            AND strftime('%Y-%m', tc2.course_date) = strftime('%Y-%m', tc.course_date)
        )
      )
    ORDER BY course_date ASC
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
    turnover:       { pct: turnoverPct, resigned: turnoverResult.numerator, headcount: turnoverResult.denominator },
    eval_coverage:  { pct: evalCoveragePct, received: evalReceivedN, total: newHireN },
    orientation:    { pct: orientationPct, passed: orientedN, total: newHireN },
    satisfaction:   { pct: satisfactionPct, responses: satisfactionN },
    probation_pass: { pct: probationPassPct, passed: evalPassedN, total: evalTotalN },
    training_plan:  { pct: trainingPlanPct, actual: trainingActualN, cancelled: trainingCancelledN, total: trainingPlannedN },
    license:        { pct: licensePct, valid: licenseValidN, total: licenseTotalN },
    new_hire_list: newHireList.results ?? [],
    resign_list: resignList.results ?? [],
    eval_coverage_list: (evalCoverageList.results ?? []).map(r => ({ ...r, has_eval: !!r.has_eval })),
    orientation_list: (orientationList.results ?? []).map(r => ({ ...r, oriented: !!r.oriented, excluded: !!r.excluded })),
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
  const { pStart, pEnd } = monthBounds(y, m);
  return { pStart, pEnd, label: `${MT[m - 1]} ${y + 543}` };
}
