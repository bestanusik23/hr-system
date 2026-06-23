import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// POST /api/manpower/resign — record a resignation
// → Master DB status=resigned, removed from active lists, eval rounds closed (filtered out)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const b = await ctx.request.json() as Record<string, unknown>;
  const { employee_id, resign_date, resign_reason, resign_type } = b;

  if (!employee_id) return Response.json({ ok: false, error: "กรุณาเลือกพนักงาน" }, { status: 400 });
  if (!resign_date)  return Response.json({ ok: false, error: "กรุณาระบุวันที่ลาออก" }, { status: 400 });

  const emp = await ctx.env.HR_DB.prepare("SELECT id, full_name, emp_status FROM employees WHERE id=?")
    .bind(employee_id).first<{ id: number; full_name: string; emp_status: string }>();
  if (!emp) return Response.json({ ok: false, error: "ไม่พบพนักงาน" }, { status: 404 });
  if (emp.emp_status === "resigned") {
    return Response.json({ ok: false, error: "พนักงานคนนี้บันทึกลาออกแล้ว" }, { status: 409 });
  }

  // 1) Update Master DB → resigned (removes from Active automatically)
  await ctx.env.HR_DB.prepare(`
    UPDATE employees SET
      emp_status='resigned', resign_date=?, resign_reason=?, resign_type=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(resign_date, resign_reason ?? null, resign_type ?? null, employee_id).run();

  // 2) Close any open (non-approved) evaluation rounds → rejected/closed
  await ctx.env.HR_DB.prepare(
    "UPDATE evaluations SET status='rejected', updated_at=datetime('now') WHERE employee_id=? AND status NOT IN ('approved')"
  ).bind(employee_id).run();

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','resign','employee',?)"
  ).bind(user.id, user.full_name, employee_id).run();

  return Response.json({ ok: true });
};
