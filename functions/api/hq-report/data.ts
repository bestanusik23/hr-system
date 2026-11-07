import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/hq-report/data — raw rows for the "รายงานส่งสำนักงานใหญ่" menu (admin only).
// Everything period-specific (month cycles, counts, bands) is computed on the client
// from these rows, so one call serves any quarter/year the admin picks.

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });

  const db = ctx.env.HR_DB;
  try {
    const [employees, plan, lineMap, extras] = await Promise.all([
      db.prepare(`
        SELECT e.id, e.prefix, e.full_name, e.position, e.emp_type, e.emp_status,
               e.start_date, e.resign_date, e.resign_reason, e.resign_type,
               COALESCE(dv.name, '') AS division_name
        FROM employees e
        LEFT JOIN divisions dv ON dv.id = e.division_id
      `).all(),
      db.prepare(`
        SELECT COALESCE(dv.name, '') AS division_name, TRIM(mp.pos) AS pos, SUM(mp.plan_qty) AS qty
        FROM manpower_plan mp
        LEFT JOIN divisions dv ON dv.id = mp.div_id
        WHERE mp.type = 'slot' AND mp.is_active = 1 AND mp.plan_qty > 0
        GROUP BY dv.name, TRIM(mp.pos)
      `).all(),
      db.prepare("SELECT division_name, position, line FROM hq_line_map").all(),
      db.prepare("SELECT employee_id, age, sourcing_channel, reason FROM hq_report_extra").all(),
    ]);
    return Response.json({
      ok: true,
      employees: employees.results ?? [],
      plan: plan.results ?? [],
      lineMap: lineMap.results ?? [],
      extras: extras.results ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table")) {
      return Response.json({ ok: false, error: "ยังไม่ได้รัน migration 0048_hq_report.sql ใน D1 Console" }, { status: 500 });
    }
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
