import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/iso-kpi/monthly?year=2569&kpi=license|orientation|competency|training
// Returns 12 months of {month, numerator, denominator, pct} for one of the
// four ISO quality-objective KPIs (FM-ISO-01-03), computed live from
// existing tables — no separate snapshot storage for the numbers themselves.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const yearBE = parseInt(url.searchParams.get("year") ?? "", 10);
  const kpi    = url.searchParams.get("kpi");
  if (!yearBE || !["license", "orientation", "competency", "training"].includes(kpi ?? "")) {
    return Response.json({ ok: false, error: "ระบุปีและ kpi ให้ถูกต้อง" }, { status: 400 });
  }
  const yearCE = yearBE - 543;
  const db = ctx.env.HR_DB;

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const results: { month: number; numerator: number; denominator: number; pct: number | null }[] = [];

  for (const m of months) {
    const mm     = String(m).padStart(2, "0");
    const pStart = `${yearCE}-${mm}-01`;
    const lastDay = new Date(yearCE, m, 0).getDate();
    const pEnd    = `${yearCE}-${mm}-${String(lastDay).padStart(2, "0")}`;

    let numerator = 0, denominator = 0;

    if (kpi === "license") {
      const denom = await db.prepare(
        "SELECT COUNT(*) AS n FROM employees WHERE license_number IS NOT NULL AND emp_status != 'resigned'"
      ).first<{ n: number }>();
      const num = await db.prepare(
        "SELECT COUNT(*) AS n FROM employees WHERE license_number IS NOT NULL AND emp_status != 'resigned' AND license_expiry IS NOT NULL AND license_expiry >= ?"
      ).bind(pEnd).first<{ n: number }>();
      denominator = denom?.n ?? 0; numerator = num?.n ?? 0;
    }

    if (kpi === "orientation") {
      const denom = await db.prepare(
        "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ?"
      ).bind(pStart, pEnd).first<{ n: number }>();
      const num = await db.prepare(`
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
      denominator = denom?.n ?? 0; numerator = num?.n ?? 0;
    }

    if (kpi === "competency") {
      const denom = await db.prepare(
        "SELECT COUNT(*) AS n FROM evaluations WHERE round = 90 AND status = 'approved' AND date(updated_at) >= ? AND date(updated_at) <= ?"
      ).bind(pStart, pEnd).first<{ n: number }>();
      const num = await db.prepare(
        "SELECT COUNT(*) AS n FROM evaluations WHERE round = 90 AND status = 'approved' AND decision = 'บรรจุเป็นพนักงานประจำ' AND date(updated_at) >= ? AND date(updated_at) <= ?"
      ).bind(pStart, pEnd).first<{ n: number }>();
      denominator = denom?.n ?? 0; numerator = num?.n ?? 0;
    }

    if (kpi === "training") {
      const counts = await db.prepare(`
        SELECT COUNT(*) AS planned_total,
          SUM(CASE WHEN COALESCE(is_cancelled,0)=0 AND status='done' THEN 1 ELSE 0 END) AS actual_done
        FROM training_courses WHERE course_date >= ? AND course_date <= ?
      `).bind(pStart, pEnd).first<{ planned_total: number; actual_done: number }>();
      denominator = counts?.planned_total ?? 0; numerator = counts?.actual_done ?? 0;
    }

    const pct = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
    results.push({ month: m, numerator, denominator, pct });
  }

  return Response.json({ ok: true, kpi, year: yearBE, months: results });
};
