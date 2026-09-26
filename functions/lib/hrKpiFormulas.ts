/// <reference types="@cloudflare/workers-types" />
import { LICENSED_POSITION_FILTER } from "./licensedPositions";
import { ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END } from "./assumedCompliance";

// Single source of truth for the KPIs that appear on both the Executive
// Dashboard (live 7-card grid, /api/exec/kpi.ts) and the ISO 9001
// quality-objective grid (FM-ISO-01-01 to 03, /api/iso-kpi/monthly.ts).
// Both callers must pass the same (pStart, pEnd) — see periodBounds.ts —
// so a given period always produces the exact same numbers in both places.

export interface KpiResult { numerator: number; denominator: number; pct: number | null }

// The 4 KPIs whose numbers appear on both dashboards, and the kpi_key each side
// uses for the same concept — used to translate when reading/writing the shared
// iso_kpi_overrides table from the Exec Dashboard's endpoints.
export const EXEC_TO_ISO_KPI_KEY: Record<string, string> = {
  license: "license", orientation: "orientation", probation_pass: "competency", training_plan: "training",
};
export const ISO_TO_EXEC_KPI_KEY: Record<string, string> = {
  license: "license", orientation: "orientation", competency: "probation_pass", training: "training_plan",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function toPct(numerator: number, denominator: number): KpiResult {
  return { numerator, denominator, pct: denominator > 0 ? round1((numerator / denominator) * 100) : null };
}

// ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ. Hires who started within the
// assumed-compliant window (see assumedCompliance.ts) count as oriented
// automatically — the underlying training records for that window predate
// consistent data entry — regardless of whether a real completion record exists.
// emp_status='transferred' is excluded from both sides: a department/position
// move can leave start_date sitting inside the period even though the person
// isn't a new hire, and orientation isn't something an existing employee redoes.
// iso_kpi_orientation_exclusions covers the same situation when the move
// wasn't recorded through the formal Transfer workflow (emp_status stayed
// e.g. 'probation'), so HR can flag it manually instead — see
// iso_kpi_license_exclusions for the same pattern on the license KPI.
const NOT_ORIENTATION_EXCLUDED = "id NOT IN (SELECT employee_id FROM iso_kpi_orientation_exclusions)";
export async function computeOrientation(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const denom = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ? AND emp_status != 'transferred' AND ${NOT_ORIENTATION_EXCLUDED}`
  ).bind(pStart, pEnd).first<{ n: number }>();
  const denominator = denom?.n ?? 0;
  const num = await db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS n
    FROM employees e
    WHERE e.start_date >= ? AND e.start_date <= ? AND e.emp_status != 'transferred' AND e.${NOT_ORIENTATION_EXCLUDED}
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
  return toPct(num?.n ?? 0, denominator);
}

// ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลปฏิบัติงาน (ทดลองงาน) / Competency.
// Same assumed-compliant treatment as orientation for periods up to the end of the
// assumed window; see the liveScope note below for evaluations approved after it.
export async function computeProbationPass(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const auto = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ? AND start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const autoN = auto?.n ?? 0;
  // A hire in the assumed-compliant window is auto-counted in the period of their start date. Their real
  // round-90 evaluation is counted too once it is approved after that window ends — but never in a period
  // that already auto-counted the same hire (e.g. a whole-year view), so nobody is counted twice at once.
  const liveScope = `AND (NOT (e.start_date >= ? AND e.start_date <= ?)
      OR (date(ev.updated_at) > ? AND NOT (e.start_date >= ? AND e.start_date <= ?)))`;
  const scopeBinds = [ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END, ASSUMED_COMPLIANT_END, pStart, pEnd];
  const total = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      ${liveScope}
  `).bind(pStart, pEnd, ...scopeBinds).first<{ n: number }>();
  const passed = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND ev.decision = 'บรรจุเป็นพนักงานประจำ'
      AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      ${liveScope}
  `).bind(pStart, pEnd, ...scopeBinds).first<{ n: number }>();
  return toPct(autoN + (passed?.n ?? 0), autoN + (total?.n ?? 0));
}

// ร้อยละของบุคลากรที่มีใบประกอบวิชาชีพถูกต้อง, as of pEnd — a snapshot metric, so it
// only needs the period's end date, not a range, to compute. That also means — unlike
// the flow-based KPIs above, which are naturally empty for a period with no data yet —
// it would happily project a real-looking percentage for a period that hasn't started,
// since license validity vs. a future date is defined either way. If the period hasn't
// started yet (pStart is still in the future), report "not yet available" instead of a
// premature forward-looking number. Employees HR has explicitly excluded
// (iso_kpi_license_exclusions) are dropped from both sides.
export async function computeLicense(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const today = new Date().toISOString().slice(0, 10);
  if (pStart > today) return { numerator: 0, denominator: 0, pct: null };
  const notExcluded = "id NOT IN (SELECT employee_id FROM iso_kpi_license_exclusions)";
  const denom = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned' AND ${LICENSED_POSITION_FILTER} AND ${notExcluded}`
  ).first<{ n: number }>();
  const num = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned' AND ${LICENSED_POSITION_FILTER} AND ${notExcluded} AND license_expiry IS NOT NULL AND license_expiry >= ?`
  ).bind(pEnd).first<{ n: number }>();
  return toPct(num?.n ?? 0, denom?.n ?? 0);
}

// ร้อยละที่อบรมตามแผน — course-count based: หลักสูตรที่จัดจริง (status='done', not
// cancelled) vs. หลักสูตรที่วางแผนไว้ทั้งหมดในช่วงนี้ (every course row for the period).
// A cancelled row is dropped entirely (both sides) when the same course name was
// actually held (status='done', not cancelled) elsewhere in the same calendar month —
// that's a reschedule, not a missed plan, so it shouldn't count against the KPI.
export async function computeTrainingPlan(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult & { cancelled: number }> {
  const counts = await db.prepare(`
    SELECT
      COUNT(*) AS planned_total,
      SUM(CASE WHEN COALESCE(is_cancelled,0)=0 AND status='done' THEN 1 ELSE 0 END) AS actual_done,
      SUM(CASE WHEN COALESCE(is_cancelled,0)=1 THEN 1 ELSE 0 END) AS cancelled
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
  `).bind(pStart, pEnd).first<{ planned_total: number; actual_done: number; cancelled: number }>();
  const result = toPct(counts?.actual_done ?? 0, counts?.planned_total ?? 0);
  return { ...result, cancelled: counts?.cancelled ?? 0 };
}

// The 3 Exec-only KPIs (no ISO equivalent) — factored out alongside the 4 shared ones
// above purely so /api/exec/kpi.ts and /api/exec/kpi-yearly.ts share one implementation
// instead of two copies that could drift.

// ร้อยละพนักงานลาออก — resigned in period / CURRENT total headcount (not headcount as of
// the period), matching the Manpower dashboard's own turnover formula.
export async function computeTurnover(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const resigned = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE resign_date >= ? AND resign_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const headcountNow = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned'"
  ).first<{ n: number }>();
  const hcNow = headcountNow?.n ?? 0;
  return { numerator: resigned?.n ?? 0, denominator: hcNow, pct: hcNow > 0 ? round1((resigned?.n ?? 0) / hcNow * 100) : 0 };
}

// ร้อยละพนักงานใหม่ที่ได้รับการประเมิน — new hires in period with at least one evaluation record.
export async function computeEvalCoverage(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const total = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const received = await db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS n FROM employees e JOIN evaluations ev ON ev.employee_id = e.id
    WHERE e.start_date >= ? AND e.start_date <= ?
  `).bind(pStart, pEnd).first<{ n: number }>();
  return toPct(received?.n ?? 0, total?.n ?? 0);
}

// ร้อยละพนักงานใหม่ที่ได้รับการประเมินตามกำหนด — per round (เดือนที่ 1/2/3 = รอบ 30/60/90 วัน
// นับจาก start_date). A round is "due" once start_date + N days has passed (and the employee
// actually has that round — employees.eval_rounds, default 3). It counts as on time when that
// round's evaluation is approved (status='approved') on or before the due date; evaluations.updated_at
// is the approval timestamp, so a later edit of an old evaluation can push it past the due date.
export interface EvalRoundResult { round: 30 | 60 | 90; month: 1 | 2 | 3; due: number; onTime: number; pct: number | null }
export const EVAL_ROUNDS: { round: 30 | 60 | 90; month: 1 | 2 | 3 }[] = [
  { round: 30, month: 1 }, { round: 60, month: 2 }, { round: 90, month: 3 },
];

export async function computeEvalOnTime(
  db: D1Database, pStart: string, pEnd: string,
): Promise<{ rounds: EvalRoundResult[]; combined: KpiResult }> {
  const today = new Date().toISOString().slice(0, 10);
  const rounds: EvalRoundResult[] = [];
  for (const { round, month } of EVAL_ROUNDS) {
    const r = await db.prepare(`
      SELECT COUNT(*) AS due,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM evaluations ev
          WHERE ev.employee_id = e.id AND ev.round = ? AND ev.status = 'approved'
            AND date(ev.updated_at) <= date(e.start_date, '+' || ? || ' days')
        ) THEN 1 ELSE 0 END) AS on_time
      FROM employees e
      WHERE e.start_date >= ? AND e.start_date <= ?
        AND COALESCE(e.eval_rounds, 3) >= ?
        AND date(e.start_date, '+' || ? || ' days') <= ?
    `).bind(round, round, pStart, pEnd, month, round, today).first<{ due: number; on_time: number | null }>();
    const due = r?.due ?? 0;
    const onTime = r?.on_time ?? 0;
    rounds.push({ round, month, due, onTime, pct: due > 0 ? round1((onTime / due) * 100) : null });
  }
  const totalDue = rounds.reduce((a, x) => a + x.due, 0);
  const totalOnTime = rounds.reduce((a, x) => a + x.onTime, 0);
  return { rounds, combined: toPct(totalOnTime, totalDue) };
}

export type EvalRoundState = "ontime" | "late" | "missing" | "waiting" | "na";
export interface EvalOnTimeRow {
  id: number; full_name: string; position: string | null; start_date: string;
  rounds: { round: 30 | 60 | 90; month: 1 | 2 | 3; state: EvalRoundState }[];
}

// Drill-down for the card: one row per new hire in the period with each round's state, so HR can
// see who is on time / late / still missing an approved evaluation.
export async function listEvalOnTime(db: D1Database, pStart: string, pEnd: string): Promise<EvalOnTimeRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.start_date, COALESCE(e.eval_rounds, 3) AS n_rounds,
      (SELECT date(ev.updated_at) FROM evaluations ev WHERE ev.employee_id = e.id AND ev.round = 30 AND ev.status = 'approved') AS a30,
      (SELECT date(ev.updated_at) FROM evaluations ev WHERE ev.employee_id = e.id AND ev.round = 60 AND ev.status = 'approved') AS a60,
      (SELECT date(ev.updated_at) FROM evaluations ev WHERE ev.employee_id = e.id AND ev.round = 90 AND ev.status = 'approved') AS a90,
      date(e.start_date, '+30 days') AS d30, date(e.start_date, '+60 days') AS d60, date(e.start_date, '+90 days') AS d90
    FROM employees e WHERE e.start_date >= ? AND e.start_date <= ? ORDER BY e.start_date ASC
  `).bind(pStart, pEnd).all<Record<string, any>>();
  return (res.results ?? []).map(r => ({
    id: r.id, full_name: r.full_name, position: r.position, start_date: r.start_date,
    rounds: EVAL_ROUNDS.map(({ round, month }) => {
      const approved: string | null = r[`a${round}`];
      const due: string = r[`d${round}`];
      let state: EvalRoundState;
      if (r.n_rounds < month) state = "na";
      else if (approved) state = approved <= due ? "ontime" : "late";
      else state = due <= today ? "missing" : "waiting";
      return { round, month, state };
    }),
  }));
}

// ร้อยละความพึงพอใจของผู้ที่ได้รับการอบรม — average survey score, not a ratio, so pct is
// computed directly by the DB rather than via toPct(); "denominator" holds the response
// count purely so callers that expect {numerator,denominator,pct} have something to show.
export async function computeSatisfaction(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const survey = await db.prepare(
    "SELECT ROUND(AVG((q1+q2+q3+q4+q5)*5.0),1) AS pct, COUNT(*) AS n FROM training_surveys WHERE date(submitted_at) >= ? AND date(submitted_at) <= ?"
  ).bind(pStart, pEnd).first<{ pct: number | null; n: number }>();
  return { numerator: survey?.n ?? 0, denominator: survey?.n ?? 0, pct: survey?.pct ?? null };
}
