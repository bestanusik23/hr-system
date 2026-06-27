import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

interface EmpRow {
  id: number; emp_code: string | null; full_name: string;
  position: string | null; emp_status: string;
  department_name: string | null; division_name: string | null;
}

// GET /api/admin/export-employees — admin only, returns all employees as JSON for emp_code reconciliation
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["admin", "hr", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await ctx.env.HR_DB.prepare(`
    SELECT e.id, e.emp_code, e.full_name, e.position, e.emp_status,
           d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE (e.eval_only = 0 OR e.eval_only IS NULL)
    ORDER BY e.emp_code NULLS LAST, e.full_name
  `).all<EmpRow>();

  return Response.json({ ok: true, employees: rows.results, total: rows.results.length });
};
