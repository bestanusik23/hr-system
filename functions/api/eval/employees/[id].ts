import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/eval/employees/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const emp = await ctx.env.HR_DB.prepare(`
    SELECT e.*, d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.id = ?
  `).bind(id).first();
  if (!emp) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  return Response.json({ ok: true, employee: emp });
};

// PUT /api/eval/employees/:id
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { full_name, emp_code, position, department_id, division_id, start_date, emp_status, eval_rounds,
          license_number, license_expiry, vehicle_plate, profession_type, emp_remark } = body;

  const rounds = Number(eval_rounds) > 0 ? Number(eval_rounds) : 3;
  await ctx.env.HR_DB.prepare(`
    UPDATE employees SET emp_code=?, full_name=?, position=?, department_id=?, division_id=?,
      start_date=?, emp_status=?, eval_rounds=?,
      license_number=?, license_expiry=?, vehicle_plate=?, profession_type=?, emp_remark=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    emp_code ?? null, full_name, position ?? null, department_id ?? null, division_id ?? null,
    start_date ?? null, emp_status ?? "probation", rounds,
    license_number ?? null, license_expiry ?? null, vehicle_plate ?? null,
    profession_type ?? null, emp_remark ?? null,
    id,
  ).run();

  return Response.json({ ok: true });
};

// DELETE /api/eval/employees/:id  — admin/hr only; blocks if approved evaluations exist
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;

  const emp = await ctx.env.HR_DB.prepare("SELECT full_name FROM employees WHERE id=?").bind(id).first<{ full_name: string }>();
  if (!emp) return Response.json({ ok: false, error: "ไม่พบพนักงาน" }, { status: 404 });

  const hasApproved = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM evaluations WHERE employee_id=? AND status='approved'"
  ).bind(id).first<{ n: number }>();

  if ((hasApproved?.n ?? 0) > 0) {
    return Response.json({ ok: false, error: "ไม่สามารถลบได้ — มีใบประเมินที่อนุมัติแล้ว กรุณาเปลี่ยนสถานะเป็น 'ลาออก' แทน" }, { status: 409 });
  }

  // Cascade: scores → approvals → evaluations → employee
  await ctx.env.HR_DB.prepare(
    "DELETE FROM evaluation_scores WHERE evaluation_id IN (SELECT id FROM evaluations WHERE employee_id=?)"
  ).bind(id).run();
  await ctx.env.HR_DB.prepare(
    "DELETE FROM evaluation_approvals WHERE evaluation_id IN (SELECT id FROM evaluations WHERE employee_id=?)"
  ).bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM evaluations WHERE employee_id=?").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM employees WHERE id=?").bind(id).run();

  return Response.json({ ok: true });
};
