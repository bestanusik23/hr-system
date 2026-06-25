import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/evaluations
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "";
  const empId  = url.searchParams.get("employee_id") ?? "";

  let sql = `
    SELECT ev.id, ev.round, ev.status, ev.grade, ev.total_score, ev.created_at, ev.updated_at,
           e.full_name, e.position, e.start_date, e.emp_status,
           d.name AS department_name, dv.name AS division_name
    FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status) { sql += " AND ev.status = ?"; params.push(status); }
  if (empId)  { sql += " AND ev.employee_id = ?"; params.push(Number(empId)); }

  if (user.role === "head" && user.scope_department_id) {
    // head sees only evaluations sent to them (not draft — draft is HR-only)
    sql += " AND e.department_id = ? AND ev.status != 'draft'"; params.push(user.scope_department_id);
  } else if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
    sql += " AND e.division_id = ?"; params.push(user.scope_division_id);
  }

  sql += " ORDER BY ev.updated_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, evaluations: rows.results });
};

// POST /api/eval/evaluations — create new evaluation (hr, head, admin)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "head", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { employee_id, round } = body;
  if (!employee_id || !round) return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });

  const emp = await ctx.env.HR_DB.prepare(
    "SELECT department_id, start_date FROM employees WHERE id = ?"
  ).bind(employee_id).first<{ department_id: number; start_date: string | null }>();

  // head: can only create eval for employees in their department
  if (user.role === "head" && user.scope_department_id) {
    if (!emp || emp.department_id !== user.scope_department_id) {
      return Response.json({ ok: false, error: "ไม่มีสิทธิ์สร้างประเมินพนักงานแผนกอื่น" }, { status: 403 });
    }
  }

  // Time-window check: head can create 7 days early only; HR/admin can create any time
  if (emp?.start_date && !["hr", "admin"].includes(user.role)) {
    const startMs = new Date(emp.start_date).getTime();
    const daysWorked = Math.floor((Date.now() - startMs) / 86400000);
    const roundDays = Number(round);
    if (daysWorked < roundDays - 7) {
      return Response.json({
        ok: false,
        error: `ยังไม่ถึงกำหนดสร้างใบประเมิน (สามารถสร้างได้เมื่อครบ ${roundDays - 7} วัน)`,
      }, { status: 422 });
    }
  }

  const existing = await ctx.env.HR_DB.prepare(
    "SELECT id FROM evaluations WHERE employee_id = ? AND round = ?"
  ).bind(employee_id, round).first();
  if (existing) return Response.json({ ok: false, error: "มีใบประเมินรอบนี้แล้ว" }, { status: 409 });

  const template_id = body.template_id ?? null;
  const isEarlyGenerated = emp?.start_date
    ? Math.floor((Date.now() - new Date(emp.start_date).getTime()) / 86400000) < Number(round)
    : false;

  let result;
  try {
    result = await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluations (employee_id, round, head_user_id, template_id, early_generated, generated_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(employee_id, round, user.id, template_id, isEarlyGenerated ? 1 : 0, user.id).run();
  } catch {
    // early_generated column may not exist yet — fall back to basic insert
    result = await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluations (employee_id, round, head_user_id, template_id) VALUES (?, ?, ?, ?)"
    ).bind(employee_id, round, user.id, template_id).run();
  }

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
