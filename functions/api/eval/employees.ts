import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// Roles that are scoped to their own division when scope_division_id is set
const SCOPED_ROLES = ["head", "deputy", "deputyHR"];

// GET /api/eval/employees
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "";
  const divId  = url.searchParams.get("division_id") ?? "";

  let sql = `
    SELECT e.id, e.full_name, e.position, e.start_date, e.emp_status, e.color, e.initial,
           d.name AS department_name, dv.name AS division_name,
           e.department_id, e.division_id
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status) { sql += " AND e.emp_status = ?"; params.push(status); }

  // Scope by division for head/deputy/deputyHR if they have a division assigned
  if (SCOPED_ROLES.includes(user.role) && user.scope_division_id) {
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
  const { full_name, position, department_id, division_id, start_date, color, initial } = body;
  if (!full_name) return Response.json({ ok: false, error: "กรุณากรอกชื่อพนักงาน" }, { status: 400 });

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO employees (full_name, position, department_id, division_id, start_date, color, initial)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(full_name, position ?? null, department_id ?? null, division_id ?? null, start_date ?? null, color ?? null, initial ?? null).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
