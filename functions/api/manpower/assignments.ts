import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/assignments?employee_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const empId = url.searchParams.get("employee_id") ?? "";

  try {
    let sql = `
      SELECT eda.*, d.name AS department_name, dv.name AS division_name
      FROM employee_department_assignment eda
      JOIN departments d ON d.id = eda.department_id
      LEFT JOIN divisions dv ON dv.id = d.division_id
      WHERE 1=1`;
    const params: (string | number)[] = [];

    if (empId) { sql += " AND eda.employee_id = ?"; params.push(Number(empId)); }

    sql += " ORDER BY eda.assignment_type DESC, eda.id ASC";
    const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
    return Response.json({ ok: true, assignments: rows.results });
  } catch {
    return Response.json({ ok: true, assignments: [] });
  }
};

// POST /api/manpower/assignments — add assignment (hr/admin)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { employee_id, department_id, assignment_type, assignment_weight, start_date, end_date, note } = body;

  if (!employee_id || !department_id) {
    return Response.json({ ok: false, error: "Missing employee_id or department_id" }, { status: 400 });
  }

  const type   = (assignment_type as string) === "primary" ? "primary" : "secondary";
  const weight = type === "primary" ? 1.0 : (Number(assignment_weight) || 0.5);

  try {
    const result = await ctx.env.HR_DB.prepare(`
      INSERT INTO employee_department_assignment
        (employee_id, department_id, assignment_type, assignment_weight, start_date, end_date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, department_id) DO UPDATE SET
        assignment_type=excluded.assignment_type,
        assignment_weight=excluded.assignment_weight,
        start_date=excluded.start_date,
        end_date=excluded.end_date,
        note=excluded.note
    `).bind(
      Number(employee_id), Number(department_id), type, weight,
      (start_date as string) ?? null, (end_date as string) ?? null, (note as string) ?? null,
    ).run();

    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
};
