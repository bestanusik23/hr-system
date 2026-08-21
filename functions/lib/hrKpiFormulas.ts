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
export async function computeOrientation(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const denom = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();
  const denominator = denom?.n ?? 0;
  const num = await db.prepare(`
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
  return toPct(num?.n ?? 0, denominator);
}

// ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลปฏิบัติงาน (ทดลองงาน) / Competency.
// Same assumed-compliant treatment as orientation; a hire's real round-90
// evaluation (if any) is excluded from the live count so it isn't double-counted.
export async function computeProbationPass(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const auto = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ? AND start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const autoN = auto?.n ?? 0;
  const total = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      AND NOT (e.start_date >= ? AND e.start_date <= ?)
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
  const passed = await db.prepare(`
    SELECT COUNT(*) AS n FROM evaluations ev JOIN employees e ON e.id = ev.employee_id
    WHERE ev.round = 90 AND ev.status = 'approved' AND ev.decision = 'บรรจุเป็นพนักงานประจำ'
      AND date(ev.updated_at) >= ? AND date(ev.updated_at) <= ?
      AND NOT (e.start_date >= ? AND e.start_date <= ?)
  `).bind(pStart, pEnd, ASSUMED_COMPLIANT_START, ASSUMED_COMPLIANT_END).first<{ n: number }>();
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
          WHERE tc2.course = tc.course AND tc2.id <> tc.id
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

// ร้อยละความพึงพอใจของผู้ที่ได้รับการอบรม — average survey score, not a ratio, so pct is
// computed directly by the DB rather than via toPct(); "denominator" holds the response
// count purely so callers that expect {numerator,denominator,pct} have something to show.
export async function computeSatisfaction(db: D1Database, pStart: string, pEnd: string): Promise<KpiResult> {
  const survey = await db.prepare(
    "SELECT ROUND(AVG((q1+q2+q3+q4+q5)*5.0),1) AS pct, COUNT(*) AS n FROM training_surveys WHERE date(submitted_at) >= ? AND date(submitted_at) <= ?"
  ).bind(pStart, pEnd).first<{ pct: number | null; n: number }>();
  return { numerator: survey?.n ?? 0, denominator: survey?.n ?? 0, pct: survey?.pct ?? null };
}
