import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/employees
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "";
  const divId  = url.searchParams.get("division_id") ?? "";

  let sql = `
    SELECT e.id, e.emp_code, e.full_name, e.position, e.start_date, e.emp_status,
           e.color, e.initial, e.eval_rounds,
           d.name AS department_name, dv.name AS division_name,
           e.department_id, e.division_id
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status) { sql += " AND e.emp_status = ?"; params.push(status); }

  if (user.role === "head" && user.scope_department_id) {
    // head: scoped to their own department (แผนก)
    sql += " AND e.department_id = ?"; params.push(user.scope_department_id);
  } else if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
    // deputy: scoped to their own division (ฝ่าย)
    sql += " AND e.division_id = ?"; params.push(user.scope_division_id);
  } else if (divId) {
    sql += " AND e.division_id = ?"; params.push(Number(divId));
  }

  sql += " ORDER BY e.created_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, employees: rows.results });
};

// POST /api/eval/employees — create employee (hr/admin only)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { full_name, emp_code, position, department_id, division_id, start_date, eval_rounds,
          license_number, license_expiry, vehicle_plate, profession_type, emp_remark } = body;
  if (!full_name) return Response.json({ ok: false, error: "กรุณากรอกชื่อพนักงาน" }, { status: 400 });

  const rounds = Number(eval_rounds) > 0 ? Number(eval_rounds) : 3;
  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO employees
      (emp_code, full_name, position, department_id, division_id, start_date, eval_only, eval_rounds,
       license_number, license_expiry, vehicle_plate, profession_type, emp_remark)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
  `).bind(
    emp_code ?? null, full_name, position ?? null, department_id ?? null, division_id ?? null,
    start_date ?? null, rounds,
    license_number ?? null, license_expiry ?? null, vehicle_plate ?? null,
    profession_type ?? null, emp_remark ?? null,
  ).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
