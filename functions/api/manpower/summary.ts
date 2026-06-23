import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/summary — Manpower CRR dashboard (cards, charts, near-probation list)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = ctx.env.HR_DB;

  // Scope clause (head → department, deputy → division). Applies to alias e.
  let scope = "";
  const sp: (string | number)[] = [];
  if (user.role === "head" && user.scope_department_id) {
    scope = " AND e.department_id = ?"; sp.push(user.scope_department_id);
  } else if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
    scope = " AND e.division_id = ?"; sp.push(user.scope_division_id);
  }

  // ── Cut-off: 26th of prev month → 25th of current month ──────────────────
  // e.g. today 2026-06-23 → period 2026-05-26 to 2026-06-25
  const pStart = "date('now','start of month','-1 month','+25 days')";
  const pEnd   = "date('now','start of month','+24 days')";

  // --- Summary cards ---
  const headcount = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status != 'resigned'${scope}`).bind(...sp).first<{ n: number }>();
  const active    = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status IN ('passed','transferred')${scope}`).bind(...sp).first<{ n: number }>();
  const probation = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status = 'probation'${scope}`).bind(...sp).first<{ n: number }>();

  const newMonth  = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees e WHERE e.start_date >= ${pStart} AND e.start_date <= ${pEnd}${scope}`
  ).bind(...sp).first<{ n: number }>();

  const resignMon = await db.prepare(
    `SELECT COUNT(*) AS n FROM employees e WHERE e.resign_date >= ${pStart} AND e.resign_date <= ${pEnd}${scope}`
  ).bind(...sp).first<{ n: number }>();

  const hc = headcount?.n ?? 0;
  const turnover_rate = hc > 0 ? Math.round(((resignMon?.n ?? 0) / hc) * 1000) / 10 : 0;

  // --- By division (non-resigned) ---
  const byDivision = await db.prepare(`
    SELECT COALESCE(dv.name,'ไม่ระบุฝ่าย') AS division, COUNT(*) AS n
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.emp_status != 'resigned'${scope}
    GROUP BY e.division_id ORDER BY n DESC
  `).bind(...sp).all<{ division: string; n: number }>();

  // --- By employee type (non-resigned) ---
  const byType = await db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(e.emp_type),''),'ไม่ระบุประเภท') AS type, COUNT(*) AS n
    FROM employees e
    WHERE e.emp_status != 'resigned'${scope}
    GROUP BY e.emp_type ORDER BY n DESC
  `).bind(...sp).all<{ type: string; n: number }>();

  // --- By employee status (non-resigned) ---
  const byStatus = await db.prepare(`
    SELECT
      CASE e.emp_status
        WHEN 'probation'   THEN 'ทดลองงาน'
        WHEN 'passed'      THEN 'ผ่านทดลองงาน'
        WHEN 'transferred' THEN 'ย้ายแผนก'
        ELSE e.emp_status
      END AS status, COUNT(*) AS n
    FROM employees e
    WHERE e.emp_status != 'resigned'${scope}
    GROUP BY e.emp_status ORDER BY n DESC
  `).bind(...sp).all<{ status: string; n: number }>();

  // --- Monthly trend (last 6 months): new hires vs resignations ---
  const hires = await db.prepare(`
    SELECT strftime('%Y-%m', e.start_date) AS m, COUNT(*) AS n
    FROM employees e
    WHERE e.start_date >= date('now','-6 months')${scope}
    GROUP BY m
  `).bind(...sp).all<{ m: string; n: number }>();
  const resigns = await db.prepare(`
    SELECT strftime('%Y-%m', e.resign_date) AS m, COUNT(*) AS n
    FROM employees e
    WHERE e.resign_date >= date('now','-6 months')${scope}
    GROUP BY m
  `).bind(...sp).all<{ m: string; n: number }>();

  // --- Near-probation-end (within 30 days, including overdue) ---
  const nearProb = await db.prepare(`
    SELECT e.id, e.emp_code, e.full_name, e.position, e.probation_end_date,
           e.color, e.initial, d.name AS department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.emp_status='probation'
      AND e.probation_end_date IS NOT NULL
      AND e.probation_end_date <= date('now','+30 days')${scope}
    ORDER BY e.probation_end_date ASC
  `).bind(...sp).all<{ id: number; emp_code: string; full_name: string; position: string; probation_end_date: string; color: string; initial: string; department_name: string }>();

  // --- Employee lists for the period (for clickable dashboard cards) ---
  const newHireList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.start_date, e.emp_type,
           COALESCE(dv.name,'ไม่ระบุ') AS division_name
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.start_date >= ${pStart} AND e.start_date <= ${pEnd}${scope}
    ORDER BY e.start_date DESC
  `).bind(...sp).all<{ id: number; full_name: string; position: string; start_date: string; emp_type: string; division_name: string }>();

  const resignList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.resign_date, e.resign_reason,
           COALESCE(dv.name,'ไม่ระบุ') AS division_name
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.resign_date >= ${pStart} AND e.resign_date <= ${pEnd}${scope}
    ORDER BY e.resign_date DESC
  `).bind(...sp).all<{ id: number; full_name: string; position: string; resign_date: string; resign_reason: string; division_name: string }>();

  return Response.json({
    ok: true,
    cards: {
      headcount: hc,
      active: active?.n ?? 0,
      probation: probation?.n ?? 0,
      new_this_month: newMonth?.n ?? 0,
      resigned_this_month: resignMon?.n ?? 0,
      turnover_rate,
    },
    period_label: getPeriodLabel(),
    by_division: byDivision.results,
    by_type: byType.results,
    by_status: byStatus.results,
    trend: { hires: hires.results, resigns: resigns.results },
    near_probation: nearProb.results,
    new_hire_list: newHireList.results,
    resign_list: resignList.results,
  });
};

function getPeriodLabel(): string {
  const now = new Date();
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const p = new Date(now.getFullYear(), now.getMonth() - 1, 26);
  const e = new Date(now.getFullYear(), now.getMonth(), 25);
  return `26 ${MT[p.getMonth()]} ${p.getFullYear() + 543} – 25 ${MT[e.getMonth()]} ${e.getFullYear() + 543}`;
}
