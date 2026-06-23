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

  // --- Summary cards ---
  const headcount = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status != 'resigned'${scope}`).bind(...sp).first<{ n: number }>();
  const active    = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status IN ('passed','transferred')${scope}`).bind(...sp).first<{ n: number }>();
  const probation = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE e.emp_status = 'probation'${scope}`).bind(...sp).first<{ n: number }>();
  const newMonth  = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE strftime('%Y-%m', e.start_date) = strftime('%Y-%m','now')${scope}`).bind(...sp).first<{ n: number }>();
  const resignMon = await db.prepare(`SELECT COUNT(*) AS n FROM employees e WHERE strftime('%Y-%m', e.resign_date) = strftime('%Y-%m','now')${scope}`).bind(...sp).first<{ n: number }>();

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
    GROUP BY type ORDER BY n DESC
  `).bind(...sp).all<{ type: string; n: number }>();

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
    by_division: byDivision.results,
    by_type: byType.results,
    trend: { hires: hires.results, resigns: resigns.results },
    near_probation: nearProb.results,
  });
};
