import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/period-employees?month=YYYY-MM
// Returns hire and resign lists for the period 26th-prev → 25th-current
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url   = new URL(ctx.request.url);
  const month = url.searchParams.get("month");
  if (!month) return Response.json({ ok: false, error: "Missing month" }, { status: 400 });

  const [y, m] = month.split("-").map(Number);
  const pStart = new Date(y, m - 2, 26).toISOString().slice(0, 10);
  const pEnd   = new Date(y, m - 1, 25).toISOString().slice(0, 10);

  const db = ctx.env.HR_DB;

  const hireList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.start_date, e.emp_type,
           COALESCE(dv.name,'ไม่ระบุ') AS division_name
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.start_date >= ? AND e.start_date <= ?
    ORDER BY e.start_date DESC
  `).bind(pStart, pEnd).all();

  const resignList = await db.prepare(`
    SELECT e.id, e.full_name, e.position, e.resign_date, e.resign_reason,
           COALESCE(dv.name,'ไม่ระบุ') AS division_name
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.resign_date >= ? AND e.resign_date <= ?
    ORDER BY e.resign_date DESC
  `).bind(pStart, pEnd).all();

  return Response.json({
    ok: true,
    new_hire_list: hireList.results,
    resign_list: resignList.results,
    period_start: pStart,
    period_end: pEnd,
  });
};
