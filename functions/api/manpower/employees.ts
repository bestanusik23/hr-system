import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/employees
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "";
  const divId  = url.searchParams.get("division_id") ?? "";
  const q      = (url.searchParams.get("q") ?? "").trim();

  let sql = `
    SELECT e.id, e.emp_code, e.full_name, e.position, e.start_date, e.emp_status,
           e.emp_type, e.probation_days, e.probation_end_date, e.remark,
           e.resign_date, e.resign_reason, e.resign_type,
           e.color, e.initial, e.department_id, e.division_id,
           e.name_en, e.license_number, e.license_expiry,
           e.car_plate_1, e.car_plate_2, e.moto_plate_1, e.moto_plate_2,
           d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status === "active") {
    sql += " AND e.emp_status IN ('passed','transferred')";
  } else if (status) {
    sql += " AND e.emp_status = ?"; params.push(status);
  }

  if (user.role === "head" && user.scope_department_id) {
    sql += " AND e.department_id = ?"; params.push(user.scope_department_id);
  } else if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
    sql += " AND e.division_id = ?"; params.push(user.scope_division_id);
  } else if (divId) {
    sql += " AND e.division_id = ?"; params.push(Number(divId));
  }

  if (q) {
    sql += ` AND (e.full_name LIKE ? OR e.emp_code LIKE ? OR e.position LIKE ?
              OR e.license_number LIKE ? OR e.car_plate_1 LIKE ? OR e.car_plate_2 LIKE ?
              OR e.moto_plate_1 LIKE ? OR e.moto_plate_2 LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like);
  }

  sql += " ORDER BY e.emp_status='resigned', e.created_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, employees: rows.results });
};
