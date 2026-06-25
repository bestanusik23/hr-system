import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/manpower/employees/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const emp = await ctx.env.HR_DB.prepare(`
    SELECT e.*, d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE e.id = ?
  `).bind(id).first();
  if (!emp) return Response.json({ ok: false, error: "ไม่พบพนักงาน" }, { status: 404 });
  return Response.json({ ok: true, employee: emp });
};

// PUT /api/manpower/employees/:id — edit master record (hr/admin)
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const b = await ctx.request.json() as Record<string, unknown>;
  const {
    full_name, name_en, position, department_id, division_id, start_date,
    emp_status, emp_type, supervisor, probation_days, remark,
  } = b;

  if (!full_name) return Response.json({ ok: false, error: "กรุณากรอกชื่อพนักงาน" }, { status: 400 });

  // Recompute probation_end_date when start_date or probation_days present
  const days = Number(probation_days) > 0 ? Number(probation_days) : 119;
  const probEnd = start_date
    ? await ctx.env.HR_DB.prepare("SELECT date(?, '+' || ? || ' days') AS d").bind(start_date, days).first<{ d: string }>()
    : null;

  await ctx.env.HR_DB.prepare(`
    UPDATE employees SET
      full_name=?, name_en=?, position=?, department_id=?, division_id=?,
      start_date=?, emp_status=?, emp_type=?, supervisor=?,
      probation_days=?, probation_end_date=?, remark=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    full_name, (name_en as string) || null, position ?? null, department_id ?? null, division_id ?? null,
    start_date ?? null, emp_status ?? "probation", emp_type ?? null, supervisor ?? null,
    days, probEnd?.d ?? null, remark ?? null, id,
  ).run();

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','edit_employee','employee',?)"
  ).bind(user.id, user.full_name, id).run();

  return Response.json({ ok: true });
};

// PATCH /api/manpower/employees/:id — quick edit: name, position, division, dept, remark only
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const b = await ctx.request.json() as Record<string, unknown>;
  const { full_name, position, division_id, department_id, remark,
          license_number, license_expiry, car_plate_1, car_plate_2, moto_plate_1, moto_plate_2 } = b;

  if (!full_name) return Response.json({ ok: false, error: "กรุณากรอกชื่อพนักงาน" }, { status: 400 });

  await ctx.env.HR_DB.prepare(`
    UPDATE employees SET full_name=?, position=?, division_id=?, department_id=?, remark=?,
      license_number=?, license_expiry=?, car_plate_1=?, car_plate_2=?, moto_plate_1=?, moto_plate_2=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    String(full_name), position ?? null, division_id ?? null, department_id ?? null, remark ?? null,
    license_number ?? null, license_expiry ?? null,
    car_plate_1 ?? null, car_plate_2 ?? null, moto_plate_1 ?? null, moto_plate_2 ?? null,
    id,
  ).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','quick_edit','employee',?)"
    ).bind(user.id, user.full_name, id).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};

// DELETE /api/manpower/employees/:id — admin/hr; blocks if approved evaluations exist
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const emp = await ctx.env.HR_DB.prepare("SELECT full_name FROM employees WHERE id=?").bind(id).first<{ full_name: string }>();
  if (!emp) return Response.json({ ok: false, error: "ไม่พบพนักงาน" }, { status: 404 });

  const approved = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM evaluations WHERE employee_id=? AND status='approved'"
  ).bind(id).first<{ n: number }>();
  if ((approved?.n ?? 0) > 0) {
    return Response.json({ ok: false, error: "ไม่สามารถลบได้ — มีใบประเมินที่อนุมัติแล้ว ใช้เมนูบันทึกลาออกแทน" }, { status: 409 });
  }

  await ctx.env.HR_DB.prepare("DELETE FROM evaluation_scores WHERE evaluation_id IN (SELECT id FROM evaluations WHERE employee_id=?)").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM evaluation_approvals WHERE evaluation_id IN (SELECT id FROM evaluations WHERE employee_id=?)").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM evaluations WHERE employee_id=?").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM employees WHERE id=?").bind(id).run();

  return Response.json({ ok: true });
};
